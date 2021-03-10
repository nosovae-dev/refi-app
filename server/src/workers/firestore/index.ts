import * as admin from "firebase-admin";
import { IServiceContext } from "../service";
import { getDocMetaData } from "../../utils/converter";
import { v4 as uuidv4 } from 'uuid';
import { deserializeDocumentSnapshotArray, DocumentSnapshot, serializeDocumentSnapshot, serializeQuerySnapshot } from "firestore-serializers";
import { isCollection } from "../../utils/navigator";

export default class FireStoreService implements NSFireStore.IService {
  private ctx: IServiceContext;
  private app: admin.app.App;
  private listListeners: NSFireStore.IListenerEntity[] = [];

  static addMetadata(doc: any) {
    doc.metadata = {
      hasPendingWrites: false,
      fromCache: false,
      isEqual(arg: any) {
        return true;
      }
    }

    return doc;
  }

  constructor(ctx: IServiceContext) {
    this.ctx = ctx;
  }

  private fsClient() {
    return admin.firestore(this.app)
  }

  public async init({ projectId }: NSFireStore.IFSInit): Promise<string[]> {
    if (this.app?.name === projectId) {
      console.log(`${projectId} already initiated`);
      const collections = await this.fsClient().listCollections();
      return collections.map(collection => collection.path)
    }

    const cert = this.ctx.localDB.get('keys').find({ projectId }).value();
    const serviceAccount = require(cert.keyPath);
    this.app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    }, projectId);

    console.log("Initiated firebase app");
    const collections = await this.fsClient().listCollections();
    return collections.map(collection => collection.path)
  }

  public async subscribeDoc({ path, topic }: NSFireStore.IDocSubscribe) {
    console.log("received event fs.query.subscribe", { path, topic });
    const close = this.fsClient()
      .doc(path)
      // .withConverter(postConverter)
      .onSnapshot(
        async (doc) => {
          const docData = serializeDocumentSnapshot(doc as any);
          this.ctx.ipc.send(topic, docData, { firestore: true });

          // TODO: Consider fetch `listCollections` outsite
          const collections = await doc.ref.listCollections();
          this.ctx.ipc.send(
            `${topic}_metadata`,
            collections.map((collection) => ({
              id: collection.id,
              path: collection.path,
            }))
          );
        },
        (error) => {
          // TODO: Handle errors here.
          // Ref: https://firebase.google.com/docs/firestore/query-data/queries#compound_queries
        }
      );

    const listenerData = {
      id: uuidv4(),
      topic,
      close,
    };
    this.listListeners.push(listenerData);

    return { id: listenerData.id };
  }

  public async subscribeCollection({ path, topic, queryOptions, sortOptions }: NSFireStore.ICollectionSubscribe) {
    console.log("received event fs.queryCollection.subscribe", { path, topic });
    console.log(sortOptions);

    const collectionRef = this.fsClient()
      .collection(path);

    let querier: FirebaseFirestore.Query = collectionRef;

    queryOptions.forEach(({ field, operator: { type, values } }) => {
      querier = querier.where(field, type, values);
    })

    sortOptions.forEach(({ field, sort }) => {
      querier = querier.orderBy(field, sort.toLowerCase() as FirebaseFirestore.OrderByDirection);
    })

    const close = querier.onSnapshot(
      async (querySnapshot) => {
        const data = serializeQuerySnapshot({
          docs: querySnapshot.docChanges().map(changes => changes.doc)
        })
        // TODO: How about hte case when we remove some things
        console.log({ data });

        this.ctx.ipc.send(topic, data, { firestore: true });
      }
    );
    // TODO: Handle error

    const listenerData = {
      id: uuidv4(),
      topic,
      close,
    };
    this.listListeners.push(listenerData);

    return { id: listenerData.id };
  };

  public async subscribePathExplorer({ path, topic }: NSFireStore.IPathSubscribe) {
    console.log("received event fs.pathExplorer", { path, topic });
    const close = this.fsClient()
      .collection(path)
      .onSnapshot(
        async (querySnapshot) => {
          const data: any[] = [];
          querySnapshot.forEach((doc) => {
            data.push(getDocMetaData(doc));
          });

          this.ctx.ipc.send(topic, data, { firestore: true });
        },
        (error) => {
          // TODO: Handle error
        }
      );

    const listenerData = {
      id: uuidv4(),
      topic,
      close,
    };
    this.listListeners.push(listenerData);

    return { id: listenerData.id };
  };

  public async updateDocs({ docs }: NSFireStore.IUpdateDocs): Promise<boolean> {
    const fs = this.fsClient();
    const docsSnapshot = deserializeDocumentSnapshotArray(docs, admin.firestore.GeoPoint, admin.firestore.Timestamp, path => fs.doc(path))
    try {
      await fs.runTransaction(async (tx) => {
        docsSnapshot.forEach(docSnapshot => {
          console.log(docSnapshot.data());
          tx.set(fs.doc(docSnapshot.ref.path), docSnapshot.data())
        })
      });

      console.log('Transaction success!');
    } catch (e) {
      console.log('Transaction failure:', e);
      throw e;
    }
    return true;
  };

  public async unsubscribe({ id }: NSFireStore.IListenerKey) {
    const dataSource = this.listListeners.filter((doc) => doc.id === id);
    dataSource.forEach((source) => {
      console.log(source);
      source.close();
    });

    this.listListeners = this.listListeners.filter((doc) => doc.id !== id);
    console.log("Success unsubscribe this stream");
    return true;
  };

  public async getDocs({ docs }: NSFireStore.IGetDocs): Promise<string> {
    const fs = this.fsClient();
    const docsSnapshot = await Promise.all(docs.map(doc => fs.doc(doc).get()))
    return serializeQuerySnapshot({
      docs: docsSnapshot
    });
  };

  public async getDocsByCollection({ path }: { path: string }): Promise<string> {
    const fs = this.fsClient();
    const docsSnapshot = await fs.collection(path).get()
    return serializeQuerySnapshot(docsSnapshot);
  };

  public async pathExpander({ path }: { path: string }): Promise<string[]> {
    const fs = this.fsClient();
    const isCollectionPath = isCollection(path);
    if (isCollection) {
      const docsSnapshot = await fs.collection(path).get()
      return docsSnapshot.docs.map(doc => doc.ref.path);
    }

    const listCollections = await fs.doc(path).listCollections();
    return listCollections.map(collection => collection.path);
  }
}