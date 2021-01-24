import * as openpgp from 'openpgp';

export type Key = openpgp.key.Key;

type Email = {
  from: string,
  to: string,
  content: string,
  title: string,
};

export async function readBase64ArmoredKey({ key }: { key: string }): Promise<Key> {
  const asUtf8 = Buffer.from(key, 'base64').toString('utf8');
  const unarmored = await openpgp.key.readArmored(asUtf8);
  const maybeKey = unarmored.keys[0];
  
  if (!maybeKey) {
    throw new Error('Unable to read base64 armored PGP key');
  }

  return maybeKey;
}

export async function secure({
  email,
  keys,
}: { 
  email: Email,
  keys: {
    recipientPublicKey: Key,
    senderPrivateKey: Key,
  }
}): Promise<Email> {
  const encryptedContent = await openpgp.encrypt({
    message: openpgp.message.fromText(email.content),
    publicKeys: [keys.recipientPublicKey],
    privateKeys: [keys.senderPrivateKey],
  });

  return {
    from: email.from,
    to: email.to,
    content: encryptedContent.data,
    title: email.title,
  };
}
