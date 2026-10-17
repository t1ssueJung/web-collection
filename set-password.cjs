// Node.js에서 실행해 배포용 비밀번호 해시를 생성합니다. 입력은 화면에 표시하지 않습니다.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const readline = require('node:readline');
const {Writable} = require('node:stream');
let muted = false;
const output = new Writable({write(chunk,encoding,callback){if(!muted)process.stdout.write(chunk,encoding);callback();}});
const rl = readline.createInterface({input:process.stdin,output,terminal:!!process.stdin.isTTY});
function ask(prompt){muted=false;process.stdout.write(prompt);muted=true;return new Promise(resolve=>rl.question('',answer=>{muted=false;process.stdout.write('\n');resolve(answer);}));}
(async()=>{
  try {
    const password=await ask('새 편집자 비밀번호 (12자 이상): ');
    const confirmation=await ask('비밀번호 다시 입력: ');
    if(password.length<12)throw Error('12자 이상을 입력하세요.');
    if(password!==confirmation)throw Error('비밀번호가 일치하지 않습니다.');
    const salt=crypto.randomBytes(32).toString('hex');
    const config={algorithm:'PBKDF2-SHA256',iterations:210000,salt,hash:crypto.pbkdf2Sync(password,Buffer.from(salt,'hex'),210000,32,'sha256').toString('hex')};
    fs.writeFileSync(path.join(__dirname,'editor-config.js'),'// 편집 화면 잠금 설정. 평문 비밀번호를 여기에 적지 마세요.\nwindow.EDITOR_CONFIG = '+JSON.stringify(config,null,2)+';\n');
    console.log('editor-config.js를 저장했습니다. GitHub에 이 파일을 교체해 배포하세요.');
  } catch(error){console.error(error.message);process.exitCode=1;} finally {rl.close();}
})();
