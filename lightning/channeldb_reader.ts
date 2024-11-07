import { strict as assert } from 'assert';

export class StringReader {
    constructor(
        private data: string,
        private pos = 0,
    ) {}

    skip(): void {
        while ([' ', '\n'].includes(this.data[this.pos])) {
            this.pos++;
        }
    }

    read(): string {
        this.skip();
        return this.data[this.pos];
    }

    readTo(s: string, skip?: boolean): string {
        if (skip) {
            this.skip();
        }
        const d = this.data.slice(this.pos, this.data.indexOf(s, this.pos));
        this.pos += d.length + s.length;
        return d;
    }

    readSingleLineData(): string {
        const d = this.data.slice(this.pos, this.data.indexOf('\n', this.pos));
        this.pos += d.length;
        if (d.endsWith(',')) {
            this.pos -= 1;
            return d.slice(0, -1);
        }
        return d;
    }

    atCursor(s: string): boolean {
        this.skip();
        const z = this.data.slice(this.pos, this.pos + s.length) === s;
        if (z) {
            this.pos += s.length;
        }
        return z;
    }

    errorMessage(error: string): string {
        const start = this.data.lastIndexOf('\n', this.pos - 1) + 1;
        let end = this.data.indexOf('\n', this.pos);
        if (end === -1) {
            end = this.data.length;
        }
        const line = this.data.slice(0, start).split('\n').length;
        return [
            `${error} at line ${line}, col ${this.pos - start + 1} (pos=${this.pos})`,
            this.data.slice(start, end),
            ' '.repeat(this.pos - start) + '^',
        ].join('\n');
    }

    assertAtCursor(s: string): void {
        if (!this.atCursor(s)) {
            throw new Error(this.errorMessage(`"${s}" != "${this.data[this.pos]}"`));
        }
    }
}

function singleLineParser<T>(fn: (data: string) => T): (reader: ChantoolsDumpReader) => T {
    return reader => fn(reader.readSingleLineData());
}

const numberParser = singleLineParser(Number);
const bigintParser = singleLineParser(BigInt);

const typeParsers = {
    bool: singleLineParser(data => data === 'true'),
    uint8: numberParser,
    int8: numberParser,
    uint16: numberParser,
    int16: numberParser,
    uint32: numberParser,
    int32: numberParser,
    uint64: bigintParser,
    int64: bigintParser,
    string: (reader: ChantoolsDumpReader) => {
        reader.assertAtCursor('"');
        return reader.readTo('"');
    },
    'channeldb.ChannelType': bigintParser,
    'chainhash.Hash': singleLineParser(data => Buffer.from(data, 'hex')),
    'lnwire.ShortChannelID': singleLineParser(data => {
        const [height, ntx, vout] = data.split(':').map(BigInt);
        return { string: data, raw: (height << 40n) | (ntx << 16n) | vout };
    }),
    'channeldb.ChannelStatus': singleLineParser(String),
    'lnwire.FundingFlag': numberParser,
    'btcutil.Amount': singleLineParser(data => Math.round(Number(data.split(' ')[0]) * 1e8)),
    'lnwire.MilliSatoshi': singleLineParser(data => BigInt(data.split(' ')[0])),
    'wire.OutPoint': singleLineParser(data => {
        const [txid, vout] = data.split(':');
        return {
            string: data,
            txid: Buffer.from(txid, 'hex'),
            txidLE: Buffer.from(txid, 'hex').reverse(),
            vout: Number(vout),
        };
    }),
    'wire.TxWitness': (reader: ChantoolsDumpReader): Buffer[] => reader.readArray() as Buffer[],
    'lnwire.DeliveryAddress': (reader: ChantoolsDumpReader) => reader.readBuffer(),
} as const;

export type ChantoolsType<Name extends keyof typeof typeParsers> = ReturnType<(typeof typeParsers)[Name]>;

type Value =
    | ChantoolsType<keyof typeof typeParsers>
    | Buffer
    | Value[]
    | { [k: string]: Value }
    | { type: string; data: unknown };

export class ChantoolsDumpReader extends StringReader {
    readValue(): Value {
        this.assertAtCursor('(');
        const type = this.readTo(')');
        if (this.read() == '(') {
            this.readTo(')');
        }
        if (type.startsWith('*')) {
            this.assertAtCursor('(');
            const v = this.readObject();
            this.assertAtCursor(')');
            return v;
        }
        if (/^\[\d*\]uint8$/.test(type)) {
            return this.readBuffer();
        } else if (type.startsWith('[]')) {
            return this.readArray();
        } else if (typeParsers[type]) {
            return typeParsers[type](this);
        } else if (this.read() === '{') {
            return this.readObject();
        } else {
            const line = this.readSingleLineData();
            return { type, data: line === '<nil>' ? null : line };
        }
    }

    readObject(): { [k: string]: Value } {
        const output = {};
        this.assertAtCursor('{');
        if (this.atCursor('}')) {
            return output;
        }
        while (true) {
            const key = this.readTo(':', true);
            assert(/^[a-zA-Z]+$/.test(key));
            output[key] = this.readValue();
            if (this.atCursor('}')) {
                break;
            }
            this.assertAtCursor(',');
        }
        return output;
    }

    readArray(): Value[] {
        const output = [];
        if (this.atCursor('<nil>')) {
            return output;
        }
        this.assertAtCursor('{');
        if (this.atCursor('}')) {
            return output;
        }
        while (true) {
            output.push(this.readValue());
            if (this.atCursor('}')) {
                break;
            }
            this.assertAtCursor(',');
        }
        return output;
    }

    readBuffer(): Buffer | null {
        if (this.atCursor('<nil>')) {
            return null;
        }
        this.assertAtCursor('{');
        let hex = '';
        while (!this.atCursor('}')) {
            this.readTo(' ');
            hex += this.readTo('|').replaceAll(' ', '');
            this.readTo('\n');
        }
        return Buffer.from(hex, 'hex');
    }
}

export type Channel = {
    ChanType: ChantoolsType<'channeldb.ChannelType'>;
    ChainHash: ChantoolsType<'chainhash.Hash'>;
    FundingOutpoint: ChantoolsType<'string'>;
    ShortChannelID: ChantoolsType<'lnwire.ShortChannelID'>;
    IsPending: ChantoolsType<'bool'>;
    IsInitiator: ChantoolsType<'bool'>;
    ChanStatus: ChantoolsType<'channeldb.ChannelStatus'>;
    FundingBroadcastHeight: ChantoolsType<'uint32'>;
    NumConfsRequired: ChantoolsType<'uint16'>;
    ChannelFlags: ChantoolsType<'lnwire.FundingFlag'>;
    IdentityPub: ChantoolsType<'string'>;
    Capacity: ChantoolsType<'btcutil.Amount'>;
    TotalMSatSent: ChantoolsType<'lnwire.MilliSatoshi'>;
    TotalMSatReceived: ChantoolsType<'lnwire.MilliSatoshi'>;
    PerCommitPoint: ChantoolsType<'string'>;
    LocalChanCfg: ChannelConfig;
    RemoteChanCfg: ChannelConfig;
    LocalCommitment: ChannelCommitment;
    RemoteCommitment: ChannelCommitment;
    RemoteCurrentRevocation: ChantoolsType<'string'>;
    RemoteNextRevocation: ChantoolsType<'string'>;
    FundingTxn: ChantoolsType<'string'>;
    LocalShutdownScript: ChantoolsType<'lnwire.DeliveryAddress'>;
    RemoteShutdownScript: ChantoolsType<'lnwire.DeliveryAddress'>;
};

type ChannelConfig = {
    ChannelConstraints: ChannelConstraints;
    MultiSigKey: KeyDescriptor;
    RevocationBasePoint: KeyDescriptor;
    PaymentBasePoint: KeyDescriptor;
    DelayBasePoint: KeyDescriptor;
    HtlcBasePoint: KeyDescriptor;
};

type ChannelConstraints = {
    DustLimit: ChantoolsType<'btcutil.Amount'>;
    ChanReserve: ChantoolsType<'btcutil.Amount'>;
    MaxPendingAmount: ChantoolsType<'lnwire.MilliSatoshi'>;
    MinHTLC: ChantoolsType<'lnwire.MilliSatoshi'>;
    MaxAcceptedHtlcs: ChantoolsType<'uint16'>;
    CsvDelay: ChantoolsType<'uint16'>;
};

type KeyDescriptor = {
    Path: ChantoolsType<'string'>;
    PubKey: ChantoolsType<'string'>;
};

type ChannelCommitment = {
    CommitHeight: ChantoolsType<'uint64'>;
    LocalLogIndex: ChantoolsType<'uint64'>;
    LocalHtlcIndex: ChantoolsType<'uint64'>;
    RemoteLogIndex: ChantoolsType<'uint64'>;
    RemoteHtlcIndex: ChantoolsType<'uint64'>;
    LocalBalance: ChantoolsType<'lnwire.MilliSatoshi'>;
    RemoteBalance: ChantoolsType<'lnwire.MilliSatoshi'>;
    CommitFee: ChantoolsType<'btcutil.Amount'>;
    FeePerKw: ChantoolsType<'btcutil.Amount'>;
    CommitTx: MsgTx;
    CommitSig: Buffer;
    Htlcs: HTLC[];
};

type MsgTx = {
    Version: ChantoolsType<'int32'>;
    TxIn: TxIn[];
    TxOut: TxOut[];
    LockTime: ChantoolsType<'uint32'>;
};

type TxIn = {
    PreviousOutPoint: ChantoolsType<'wire.OutPoint'>;
    SignatureScript: Buffer;
    Witness: ChantoolsType<'wire.TxWitness'>;
    Sequence: ChantoolsType<'uint32'>;
};

type TxOut = {
    Value: ChantoolsType<'uint64'>;
    PkScript: Buffer;
};

type HTLC = {
    Signature: Buffer;
    RHash: Buffer;
    Amt: ChantoolsType<'lnwire.MilliSatoshi'>;
    RefundTimeout: ChantoolsType<'uint32'>;
    OutputIndex: ChantoolsType<'int32'>;
    Incoming: ChantoolsType<'bool'>;
    OnionBlob: Buffer;
    HtlcIndex: ChantoolsType<'uint64'>;
    LogIndex: ChantoolsType<'uint64'>;
};

export function parseChannelDB(dump: string): Channel[] {
    return new ChantoolsDumpReader(dump).readValue() as Channel[];
}
