import * as firebaseAdmin from 'firebase-admin';
import { time } from '../../lib/utils';

interface Find {
    _id: string;
    to: string;
    from: string;
    value: number;
    given_at: Date;
}

interface Sum {
    _id?: string; // Username
    score?: number;
}

interface Query {
    key: string,
    operator: string,
    value: string|Date
}

const DOC_NAME = 'heyBurrito';

class FirestoreDrive {
    constructor(public db = null) {
        firebaseAdmin.initializeApp({
            credential: firebaseAdmin.credential.applicationDefault(),
        });
        this.db = firebaseAdmin.firestore();
    }

    async store(collection: string, data: Object) {
        const docRef = this.db.collection(collection);
        return docRef.add(data);
    }

    give(to: string, from: string, date: any) {
        return this.store(DOC_NAME, {
            to,
            from,
            value: 1,
            given_at: date,
        });
    }

    takeAway(to: string, from: string, date: any) {
        return this.store(DOC_NAME, {
            to,
            from,
            value: -1,
            given_at: date,
        });
    }

    async getSnapShot(collection: string): Promise<any[]> {
        const rest = this.db.collection(collection);
        return rest.get();
    }

    /**
     * @param { string } collection -  like burrito
     * @param { Object | Query } query - searchObject to search for
     * @return { Find[] }
     */
    async find(collection: string, query: Query[]): Promise<Find[]> {
        console.log('find --> query', query);
        let rest = this.db.collection(collection);
        if (query.length > 0) {
            for (let j = 0; j < query.length; j += 1) {
                const q = query[j];
                rest = rest.where(q.key, q.operator, q.value);
            }
        }
        const snapshot = await rest.get();
        const data = [];
        snapshot.forEach((doc) => {
            data.push({
                _id: doc.id,
                to: doc.data().to,
                from: doc.data().from,
                value: doc.data().value,
                given_at: 123123,
            });
        });
        return data;
    }

    /**
     * @param { string } collection - burrito
     * @param { string | null } match - matchObject to search for
     * @param { string } listType - defaults to 'to'
     * @return { Object } sum[] - data
     */
    async sum(
        collection: string,
        match: Object = null,
        listType: string,
    ): Promise<Sum[]> {
        const aggregations: Array<Object> = [
            { $match: { to: { $exists: true } } },
        ];
        if (match) {
            aggregations.push({ $match: match });
        }
        aggregations.push({
            $group: { _id: listType, score: { $sum: '$value' } },
        });
        aggregations.push({ $sort: { score: -1 } });
        return this.db.collection(collection).aggregate(aggregations).toArray();
    }

    /**
     * Finds all entrys associated to user today
     * @params { string } user => userid
     * @params { string } listtype => to / from
     * @returns {Find[]}
     */
    findFromToday(user: string, listType: string): Promise<Find[]> {
        const query = [
            {
                key: listType,
                operator: '==',
                value: user,
            },
            {
                key: 'given_at',
                operator: '>',
                value: time().start,
            },
            {
                key: 'given_at',
                operator: '<',
                value: time().end,
            },
        ];
        return this.find(DOC_NAME, query);
    }

    /**
     * Return specific userScore
     * @param {string} user - userId
     * @param {string} listType - to / from
     * @return {Object} sum[]
     */
    async getScore(user: string, listType: string, num = false) {
        const query = [
            {
                key: listType,
                operator: '==',
                value: user,
            },
        ];
        const data = await this.find(DOC_NAME, query);
        if (num) {
            const score: number = data.reduce(
                (a: number, item: any) => a + item.value,
                0,
            );
            return score;
        }
        return data;
    }

    /**
     * Returns scoreboard
     * Should be able to return burrito List ( scoreType inc ) and
     * listtype ( dec ) AKA rottenburritoList
     */
    async getScoreBoard({ user, listType, today }) {
        const query = [];

        if (user) {
            const key = listType === 'from' ? 'to' : 'from';
            query.push({
                key,
                operator: '==',
                value: user,
            });
        }

        if (today) {
            query.push(
                {
                    key: 'given_at',
                    operator: '>',
                    value: time().start,
                },
            );

            query.push(
                {
                    key: 'given_at',
                    operator: '<',
                    value: time().end,
                },
            );
        }
        return this.find(DOC_NAME, query);
    }

    static convertTimeInMillisecondsToNewData(milliseconds: number): Date {
        return new Date(milliseconds * 1000);
    }
}

export default FirestoreDrive;
