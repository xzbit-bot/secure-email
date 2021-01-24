import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import * as openpgp from 'openpgp';

import { secure, readBase64ArmoredKey } from '../src';

chai.use(chaiAsPromised);
const { expect } = chai;

async function generateKeys({
  name,
  email,
}: {
  name: string,
  email: string,
}): Promise<{ publicKey: openpgp.key.Key, privateKey: openpgp.key.Key }> {
  const { privateKeyArmored, publicKeyArmored } = await openpgp.generateKey({
    userIds: [{ name, email }],
    numBits: 2048,
  });

  const unarmoredPrivateKeys = await openpgp.key.readArmored(privateKeyArmored);
  const unarmoredPublicKeys = await openpgp.key.readArmored(publicKeyArmored);

  const [privateKey] = unarmoredPrivateKeys.keys;
  const [publicKey] = unarmoredPublicKeys.keys;

  return { privateKey, publicKey };
}

describe('secure-email', () => {
  describe('secure', () => {
    it('Alice should be able to send an enctypted email to Bob', async () => {
      const aliceKeys = await generateKeys({ email: 'alice@email.com', name: 'Alice' });
      const bobKeys = await generateKeys({ email: 'bob@email.com', name: 'Bob' });

      const clearEmail = {
        from: 'alice@email.com',
        to: 'bob@email.com',
        content: 'This is an expected content',
        title: 'Shh this is a secret',
      };

      const encryptedEmail = await secure({
        email: clearEmail,
        keys: {
          recipientPublicKey: bobKeys.publicKey,
          senderPrivateKey: aliceKeys.privateKey,
        },
      });

      expect(encryptedEmail.content).not.to.equal('This is an expected content');
      expect(encryptedEmail.title).to.equal('Shh this is a secret');
      expect(encryptedEmail.from).to.equal('alice@email.com');
      expect(encryptedEmail.to).to.equal('bob@email.com');
    });

    it('Bob should be able to decrypt an email from Alice', async () => {
      const aliceKeys = await generateKeys({ email: 'alice@email.com', name: 'Alice' });
      const bobKeys = await generateKeys({ email: 'bob@email.com', name: 'Bob' });

      const clearEmail = {
        from: 'alice@email.com',
        to: 'bob@email.com',
        content: 'This is an expected content',
        title: 'Shh this is a secret',
      };

      const encryptedEmail = await secure({
        email: clearEmail,
        keys: {
          recipientPublicKey: bobKeys.publicKey,
          senderPrivateKey: aliceKeys.privateKey,
        },
      });

      const message = await openpgp.message.readArmored(encryptedEmail.content);
  
      const { data } = await openpgp.decrypt({
        message,
        privateKeys: [bobKeys.privateKey],
      });

      expect(data).to.equal('This is an expected content');
    });

    it('Bob should be able to verify an email signed by Alice', async () => {
      const aliceKeys = await generateKeys({ email: 'alice@email.com', name: 'Alice' });
      const bobKeys = await generateKeys({ email: 'bob@email.com', name: 'Bob' });

      const clearEmail = {
        from: 'alice@email.com',
        to: 'bob@email.com',
        content: 'This is an expected content',
        title: 'Shh this is a secret',
      };

      const encryptedEmail = await secure({
        email: clearEmail,
        keys: {
          recipientPublicKey: bobKeys.publicKey,
          senderPrivateKey: aliceKeys.privateKey,
        },
      });

      const message = await openpgp.message.readArmored(encryptedEmail.content);
  
      const { signatures } = await openpgp.decrypt({
        message,
        privateKeys: [bobKeys.privateKey],
        publicKeys: [aliceKeys.publicKey],
      });

      expect(signatures[0].valid).to.be.true;
    });
  });

  describe('readBase64ArmoredKey', () => {
    it('Should throw on invalid key', async () => {
      const resultPromise = readBase64ArmoredKey({
        key: Buffer.from('this is definitely invalid').toString('base64'),
      });

      await expect(resultPromise).to.be.rejectedWith('Unable to read base64 armored PGP key');
    });

    it('Should read a base64 armored key', async () => {
      const { privateKeyArmored } = await openpgp.generateKey({
        userIds: [{ email: 'email@provider.com', name: 'Not Sure' }],
        numBits: 2048,
      });
      const asBase64 = Buffer.from(privateKeyArmored).toString('base64');

      const result = await readBase64ArmoredKey({ key: asBase64 });

      expect(result).to.be.instanceof(openpgp.key.Key);
    });
  });
});