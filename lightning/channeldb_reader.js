"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseChannelDB = exports.ChantoolsDumpReader = exports.StringReader = void 0;
const assert_1 = require("assert");
class StringReader {
    constructor(data, pos = 0) {
        this.data = data;
        this.pos = pos;
    }
    skip() {
        while ([' ', '\n'].includes(this.data[this.pos])) {
            this.pos++;
        }
    }
    read() {
        this.skip();
        return this.data[this.pos];
    }
    readTo(s, skip) {
        if (skip) {
            this.skip();
        }
        const d = this.data.slice(this.pos, this.data.indexOf(s, this.pos));
        this.pos += d.length + s.length;
        return d;
    }
    readSingleLineData() {
        const d = this.data.slice(this.pos, this.data.indexOf('\n', this.pos));
        this.pos += d.length;
        if (d.endsWith(',')) {
            this.pos -= 1;
            return d.slice(0, -1);
        }
        return d;
    }
    atCursor(s) {
        this.skip();
        const z = this.data.slice(this.pos, this.pos + s.length) === s;
        if (z) {
            this.pos += s.length;
        }
        return z;
    }
    errorMessage(error) {
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
    assertAtCursor(s) {
        if (!this.atCursor(s)) {
            throw new Error(this.errorMessage(`"${s}" != "${this.data[this.pos]}"`));
        }
    }
}
exports.StringReader = StringReader;
function singleLineParser(fn) {
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
    string: (reader) => {
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
    'wire.TxWitness': (reader) => reader.readArray(),
    'lnwire.DeliveryAddress': (reader) => reader.readBuffer(),
};
class ChantoolsDumpReader extends StringReader {
    readValue() {
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
        }
        else if (type.startsWith('[]')) {
            return this.readArray();
        }
        else if (typeParsers[type]) {
            return typeParsers[type](this);
        }
        else if (this.read() === '{') {
            return this.readObject();
        }
        else {
            const line = this.readSingleLineData();
            return { type, data: line === '<nil>' ? null : line };
        }
    }
    readObject() {
        const output = {};
        this.assertAtCursor('{');
        if (this.atCursor('}')) {
            return output;
        }
        while (true) {
            const key = this.readTo(':', true);
            (0, assert_1.strict)(/^[a-zA-Z]+$/.test(key));
            output[key] = this.readValue();
            if (this.atCursor('}')) {
                break;
            }
            this.assertAtCursor(',');
        }
        return output;
    }
    readArray() {
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
    readBuffer() {
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
exports.ChantoolsDumpReader = ChantoolsDumpReader;
function parseChannelDB(dump) {
    return new ChantoolsDumpReader(dump).readValue();
}
exports.parseChannelDB = parseChannelDB;
