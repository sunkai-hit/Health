import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';

const path='miniapp/';
const file=p=>readFileSync(path+p,'utf8');
const settingsPath='config/cloud-env.js';
const settings=requireModule(file(settingsPath));

function requireModule(source){
  const exports={};
  vm.runInNewContext(source,{module:{exports},exports});
  // module.exports is the intended export; create a new context for parsing
  const context={module:{exports:{}},exports:{}};
  vm.runInNewContext(source,context);
  return context.module.exports;
}
function loadApp(settings,wx){
  let app;
  vm.runInNewContext(file('app.js'),{
    App:config=>{app=config;},
    require:(name)=>{assert.equal(name,'./config/cloud-env');return settings;},
    wx
  });
  return app;
}
function loadPage(settings,wx,app){
  let page;
  vm.runInNewContext(file('pages/dev-cloud/dev-cloud.js'),{
    Page:config=>{page=config;},
    require:(name)=>{assert.equal(name,'../../config/cloud-env');return settings;},
    getApp:()=>app,wx
  });
  page.data={...page.data};
  page.setData=function(changes){Object.assign(this.data,changes);};
  return page;
}
test('user-provided CloudBase environment is explicitly probe-only',()=>{
  assert.equal(settings.enabled,true);
  assert.equal(settings.envId,'health-d2gxjb20h1d33fa91');
  assert.equal(settings.purpose,'synthetic-ping-only');
  assert.match(settings.envId,/^[a-zA-Z0-9_-]{4,80}$/);
});
test('project uses explicit local CloudBase function root, not HTTP endpoint',()=>{
  const project=JSON.parse(file('project.config.json'));
  assert.equal(project.cloudfunctionRoot,'cloudfunctions/');
  assert.ok(existsSync(path+'cloudfunctions/healthDevPing/index.js'));
  assert.ok(existsSync(path+'cloudfunctions/healthDevPing/package.json'));
});
test('configured App startup initializes SDK but never invokes the cloud function',()=>{
  let initialized=0,requests=0;
  const app=loadApp(settings,{cloud:{
    init(options){
      initialized++;
      assert.equal(options.env,'health-d2gxjb20h1d33fa91');
      assert.equal(options.traceUser,false);
    },
    callFunction(){requests++;}
  }});
  app.onLaunch();
  assert.equal(initialized,1);
  assert.equal(requests,0);
  assert.equal(app.globalData.cloudDemoReady,true);
  assert.equal(app.globalData.safeToStoreRealHealthData,false);
});
test('cloud config needs enabled switch, valid env identifier and synthetic purpose',()=>{
  let called=0;
  const wx={cloud:{init(){called++;}}};
  for(const config of [
    {enabled:true,envId:'',purpose:'synthetic-ping-only'},
    {enabled:true,envId:'<placeholder>',purpose:'synthetic-ping-only'},
    {enabled:false,envId:'health-test-env-123',purpose:'synthetic-ping-only'},
    {enabled:true,envId:'health-test-env-123',purpose:'real-health-data'}
  ]){
    const app=loadApp(config,wx);
    app.onLaunch();
    assert.equal(app.globalData.cloudDemoReady,false);
  }
  assert.equal(called,0);
});
test('explicitly enabled CloudBase environment can initialize without custom HTTPS domain',()=>{
  let options;
  const app=loadApp({enabled:true,envId:'health-test-env-123',purpose:'synthetic-ping-only'},{
    cloud:{init(arg){options=arg;}}
  });
  app.onLaunch();
  assert.equal(options.env,'health-test-env-123');
  assert.equal(options.traceUser,false);
  assert.equal(app.globalData.cloudDemoReady,true);
});
test('SDK initialization failure leaves manual ping unavailable',async()=>{
  let invoked=0;
  const wx={cloud:{
    init(){throw Error('env not linked to AppID');},
    callFunction(){invoked++;}
  }};
  const app=loadApp(settings,wx);
  app.onLaunch();
  assert.equal(app.globalData.cloudDemoReady,false);
  const page=loadPage(settings,wx,app);
  page.onLoad();
  assert.equal(page.data.available,false);
  await page.runPing();
  assert.equal(invoked,0);
});
test('cloud test screen stays disabled when CloudBase is not initialized',async()=>{
  let called=0;
  const disabled={...settings,enabled:false};
  const app=loadApp(disabled,{cloud:{init(){called++;}}});
  app.onLaunch();
  const page=loadPage(disabled,{cloud:{callFunction(){called++;throw Error('NETWORK_UNEXPECTED');}}},app);
  page.onLoad();
  assert.equal(page.data.available,false);
  await page.runPing();
  assert.equal(called,0);
});
test('only the named synthetic ping function is allowed after explicit enablement',async()=>{
  let calls=0,name,data;
  const wx={cloud:{
    init(){},
    callFunction:async args=>{
      calls++;name=args.name;data=args.data;
      return {result:{ok:true,mode:'synthetic-read-only',
        canStoreHealthData:false,accountAuthenticated:false}};
    }
  }};
  const config={enabled:true,envId:'health-test-env-123',purpose:'synthetic-ping-only'};
  const app=loadApp(config,wx);app.onLaunch();
  const page=loadPage(config,wx,app);page.onLoad();
  assert.equal(page.data.available,true);
  await page.runPing();
  assert.equal(calls,1);
  assert.equal(name,'healthDevPing');
  assert.deepEqual({...data},{});
  assert.match(page.data.message,/测试函数已连接/);
  assert.equal(page.data.loading,false);
});
test('invalid cloud response never marks real login or storage as ready',async()=>{
  const cfg={enabled:true,envId:'health-test-env-123',purpose:'synthetic-ping-only'};
  const wx={cloud:{
    init(){},
    callFunction:async()=>({result:{ok:true,mode:'synthetic-read-only',
      canStoreHealthData:true,accountAuthenticated:true}})
  }};
  const app=loadApp(cfg,wx);app.onLaunch();
  const page=loadPage(cfg,wx,app);page.onLoad();
  await page.runPing();
  assert.match(page.data.message,/连接未完成/);
  assert.equal(page.data.loading,false);
});
test('CloudBase ping function returns only fixed synthetic metadata',async()=>{
  const fn={exports:{}};
  vm.runInNewContext(file('cloudfunctions/healthDevPing/index.js'),fn);
  const output=await fn.exports.main({
    openid:'attacker-controlled',title:'sensitive',
    owner_id:'attacker-controlled',action:'create_event'
  });
  assert.equal(output.ok,true);
  assert.equal(output.mode,'synthetic-read-only');
  assert.equal(output.canStoreHealthData,false);
  assert.equal(output.accountAuthenticated,false);
  assert.ok(!JSON.stringify(output).includes('openid'));
  assert.ok(!JSON.stringify(output).includes('sensitive'));
  assert.ok(!JSON.stringify(output).includes('owner_id'));
});
test('CloudBase shell has no direct cloud database, storage, login or HTTP access',()=>{
  const files=['app.js','pages/index/index.js','pages/timeline/timeline.js','pages/dev-cloud/dev-cloud.js'];
  for(const name of files){
    const s=file(name);
    assert.ok(!/\bwx\.(?:request|login|getPhoneNumber)\s*\(/.test(s),name);
    assert.ok(!/\bwx\.cloud\.(?:database|uploadFile|downloadFile|deleteFile|callContainer)\s*\(/.test(s),name);
  }
  const probe=file('cloudfunctions/healthDevPing/index.js');
  assert.ok(!/\bcloud\.(?:database|uploadFile|getWXContext)\b/.test(probe));
});
