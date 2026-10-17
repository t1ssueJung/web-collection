// 화면 편집 잠금입니다. 공용 데이터의 접근 제어는 서버에서 구현해야 합니다.
(() => {
  'use strict';
  const iterations = 210000;
  const hex = buffer => Array.from(new Uint8Array(buffer), x => x.toString(16).padStart(2, '0')).join('');
  function bytes(value) {
    if (typeof value !== 'string' || !/^(?:[0-9a-f]{2})+$/i.test(value)) throw Error('편집자 비밀번호 설정을 확인하세요.');
    return Uint8Array.from(value.match(/../g), x => parseInt(x, 16));
  }
  async function derive(password, salt, rounds) {
    if (!globalThis.crypto?.subtle) throw Error('HTTPS 또는 localhost에서 접속해 주세요.');
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:bytes(salt),iterations:rounds}, key, 256));
  }
  async function verify(password, config) {
    if (!config || config.algorithm !== 'PBKDF2-SHA256' || !Number.isInteger(config.iterations) || config.iterations < 100000 || config.iterations > 1000000 || bytes(config.salt).length < 16 || bytes(config.hash).length !== 32) throw Error('편집자 비밀번호 설정을 확인하세요.');
    const actual = await derive(password, config.salt, config.iterations);
    let mismatch = 0;
    for (let i=0;i<actual.length;i++) mismatch |= actual.charCodeAt(i) ^ config.hash.charCodeAt(i);
    return mismatch === 0;
  }
  globalThis.EditorAuth = Object.freeze({verify, iterations});
})();
