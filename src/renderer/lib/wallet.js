import { Keypair, StrKey } from 'stellar-base';
import BaseX from 'base-x';
import crypto from 'crypto';
import rlp from 'rlp';
import PromiseWorker from 'promise-worker';
import config from 'config';

const worker = new PromiseWorker(new Worker('/worker.js'));
const B58 = BaseX('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz');
const iv = Buffer.from([0x42, 0x4F, 0x53, 0x5F, 0x43, 0x4F, 0x49, 0x4E,
  0x5F, 0x57, 0x41, 0x4C, 0x4C, 0x45, 0x54, 0x53]);

export default {
  random() {
    return Keypair.random();
  },
  encodeB58(source) {
    return B58.encode(source);
  },
  decodeB58(encoded) {
    return B58.decode(encoded);
  },
  hash(payload) {
    const salt = config.get('salt');
    return worker.postMessage(['argon2', {
      bytes: rlp.encode(payload),
      salt,
    }]).then(hash => this.encodeB58(hash));
  },
  sign(seed, data) {
    const networkId = config.get('network');
    return this.encodeB58(Keypair.fromSecret(seed).sign(networkId + data));
  },
  parsePubKey(seed) {
    return Keypair.fromSecret(seed).publicKey();
  },
  createKey(passphrase) {
    return crypto.createHash('sha256').update(passphrase).digest();
  },
  encryptWallet(passphrase, seed) {
    const cipher = crypto.createCipheriv('aes256', this.createKey(passphrase), iv);
    const encrypted = cipher.update(seed, 'utf8');
    return B58.encode(Buffer.concat([encrypted, cipher.final()]));
  },
  decryptWallet(passphrase, encoded) {
    const decipher = crypto.createDecipheriv('aes256', this.createKey(passphrase), iv);
    const decrypted = decipher.update(B58.decode(encoded), 'binary', 'utf8');
    return decrypted + decipher.final('utf8');
  },
  createFreezeAccount(seed, seqId) {
    const buffer = Buffer.alloc(40);
    StrKey.decodeEd25519SecretSeed(seed).copy(buffer);
    buffer.writeUIntBE(seqId, 32, 8);
    const hm = crypto.createHmac('sha512', 'freeze-account');
    hm.update(buffer);
    const rawSeed = hm.digest();
    return Keypair.fromRawEd25519Seed(rawSeed.slice(0, 32));
  },
};
