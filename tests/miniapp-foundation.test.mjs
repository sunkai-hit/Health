/** Structural gate for read-only native WeChat shell.
 * This is NOT a real-device, WeChat DevTools or WeChat platform certification.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const root='miniapp/';
const read=(p)=>readFileSync(root+p,'utf8');
const app=JSON.parse(read('app.json'));
const project=JSON.parse(read('project.config.json'));
test('native Mini Program routes have WXML/WXSS/JS/JSON files',()=>{
  assert.deepEqual(app.pages,['pages/index/index','pages/timeline/timeline','pages/dev-cloud/dev-cloud']);
  for(const route of app.pages){
    for(const ext of ['js','wxml','wxss','json']){
      assert.ok(existsSync(root+route+'.'+ext),route+'.'+ext+' missing');
    }
    JSON.parse(read(route+'.json'));
  }
});
test('Mini Program project uses the user-provided AppID (format only, not ownership verified)',()=>{
  assert.equal(project.compileType,'miniprogram');
  assert.equal(project.appid,'wx027f1a9c66e3c01a');
  assert.match(project.appid,/^wx[0-9a-fA-F]{16}$/);
  assert.equal(project.setting.urlCheck,true);
});
test('native pages use WXML and do not embed an insecure web-view wrapper',()=>{
  for(const route of app.pages){
    const wxml=read(route+'.wxml');
    assert.ok(wxml.includes('<view'));
    assert.ok(!/<web-view\b/i.test(wxml));
    assert.ok(!/<input\b|<textarea\b|open-type\s*=\s*["']getPhoneNumber/i.test(wxml),'S4 must remain read-only');
  }
});
test('no network requests, real login, credentials or local persistence in client JS',()=>{
  const files=['app.js',...app.pages.map(r=>r+'.js')];
  for(const p of files){
    const value=read(p);
    assert.ok(!/\bwx\.(?:request|login|uploadFile|downloadFile|setStorage|setStorageSync|getStorage|getStorageSync)\s*\(/.test(value),p+' attempted network/login/storage');
    assert.ok(!/\bAppSecret\b\s*[:=]|\bsession_key\b\s*[:=]|\bopenid\b\s*[:=]/i.test(value),p+' contains suspicious WeChat secrets');
    assert.ok(!/https?:\/\//.test(value),p+' hardcoded a remote endpoint');
  }
});
test('the only bundled timeline content explicitly identifies synthetic data',()=>{
  const js=read('pages/timeline/timeline.js');
  const wxml=read('pages/timeline/timeline.wxml');
  assert.ok(js.includes('虚构'));
  assert.ok(wxml.includes('虚构'));
  assert.ok(read('pages/index/index.wxml').includes('请勿录入真实个人健康数据'));
});
test('search indexing is disabled for the synthetic shell',()=>{
  const sitemap=JSON.parse(read('sitemap.json'));
  assert.deepEqual(sitemap.rules,[{action:'disallow',page:'*'}]);
});
