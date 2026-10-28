const {chromium}=require('playwright')
const {spawn}=require('node:child_process')
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict')
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:5196',out=path.resolve(root,'../test-artifacts/entry-fit')
let server,browser
;(async()=>{
 fs.mkdirSync(out,{recursive:true})
 server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','5196','--strictPort'],{cwd:root,stdio:['ignore','pipe','pipe']})
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Preview timeout')),20000);server.stdout.on('data',d=>{if(d.toString().includes('5196')){clearTimeout(timer);resolve()}});server.on('exit',c=>reject(Error('Preview exited '+c)))})
 browser=await chromium.launch({headless:true})
 const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.addInitScript(()=>localStorage.setItem('jumble.preferences',JSON.stringify({theme:'light'})))
 for(const [width,height] of [[2560,1440],[1920,1080],[1366,768],[390,844]]){
  await page.setViewportSize({width,height})
  for(const route of ['/','/login']){
   await page.goto(base+route)
   await page.locator('main.entry').waitFor()
   const dimensions=await page.locator('main.entry').boundingBox()
   assert.equal(Math.round(dimensions.width),width,route+' full width')
   if(width>700){assert.equal(Math.round(dimensions.height),height,route+' full height');assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),true,route+' vertical overflow')}
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,route+' horizontal overflow')
   if(route==='/'){const play=await page.getByRole('link',{name:'Let’s play'}).boundingBox();assert.equal(play.y+play.height<=height,true,'Entry action visible')}
   if(width===1920||width===390)await page.screenshot({path:path.join(out,(route==='/'?'entry':'login')+'-'+width+'.png'),fullPage:true})
  }
 }
 assert.deepEqual(errors,[])
 console.log('Entry/login fit passed: full desktop viewport at 2560, 1920, and 1366 widths, no horizontal overflow, visible entry action, and responsive mobile layout.')
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill()})
