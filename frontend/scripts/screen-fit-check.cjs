const {chromium}=require('playwright')
const {spawn}=require('node:child_process')
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict')
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:5197',out=path.resolve(root,'../test-artifacts/screen-fit')
let server,browser,page
;(async()=>{
 fs.mkdirSync(out,{recursive:true})
 server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'preview',...(process.env.UI_CHECK_DIST?['--outDir',process.env.UI_CHECK_DIST]:[]),'--host','127.0.0.1','--port','5197','--strictPort'],{cwd:root,stdio:['ignore','pipe','pipe']})
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Preview timeout')),20000);server.stdout.on('data',d=>{if(d.toString().includes('5197')){clearTimeout(timer);resolve()}});server.on('exit',c=>reject(Error('Preview exited '+c)))})
 browser=await chromium.launch({headless:true})
 page=await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'})
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 // This check isolates layout; login and hosting flows have separate browser coverage.
 await page.addInitScript(()=>{if(!sessionStorage.getItem('fit-initialized')){localStorage.setItem('jumble.session',JSON.stringify({token:'layout-fixture',user:{id:'GIPL042',name:'Layout Player'}}));sessionStorage.setItem('fit-initialized','true')}})
 await page.goto(base+'/dashboard')
 await page.locator('.shell').waitFor()
 async function fits(selector,width,minHeight){await page.locator(selector).waitFor();const rect=await page.locator(selector).boundingBox();assert.equal(Math.round(rect.width),width,page.url()+' full width');assert.equal(rect.height>=minHeight-1,true,page.url()+' viewport height');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,page.url()+' horizontal overflow')}
 for(const [width,height] of [[1920,1080],[1366,768],[390,844]]){
  await page.setViewportSize({width,height})
  for(const route of ['/dashboard','/create','/games','/history','/last-results','/profile','/settings']){
   await page.goto(base+route);await page.locator('.shell').waitFor()
   await fits('.shell',width,width>700?height:height-64)
   if(width===1920&&route==='/dashboard')await page.screenshot({path:path.join(out,'dashboard-wide.png'),fullPage:true})
  }
 }
 await page.setViewportSize({width:1920,height:1080});await page.goto(base+'/dashboard')
 await page.getByRole('button',{name:'Host Game',exact:true}).first().click()
 await page.getByRole('button',{name:'Open lobby',exact:true}).click();await page.waitForURL('**/control/lobby')
 await fits('.shell',1920,1080)
 await page.setViewportSize({width:390,height:844});await fits('.shell',390,780)
 await page.getByRole('link',{name:'Dashboard',exact:true}).first().click()
 await page.getByRole('button',{name:'Join Game',exact:true}).click();await page.waitForURL('**/lobby')
 await fits('.shell',390,780)
 await page.goto(base+'/control/lobby');await page.getByRole('button',{name:'Start Game',exact:true}).click();await page.waitForURL('**/control/game')
 await fits('.shell',390,780)
 await page.goto(base+'/game');await page.locator('.arena-standings').waitFor();await fits('.shell',390,780)
 await page.screenshot({path:path.join(out,'player-game-mobile.png'),fullPage:true})
 await page.setViewportSize({width:1920,height:1080});await fits('.shell',1920,1080)
 await page.screenshot({path:path.join(out,'player-game-wide.png'),fullPage:true})
 await page.getByRole('button',{name:'Log out',exact:true}).click()
 for(const route of ['/','/login']){await page.setViewportSize({width:1920,height:1080});await page.goto(base+route);await page.locator('.entry').waitFor();await fits('.entry',1920,1080);assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),true,route+' desktop vertical overflow');await page.screenshot({path:path.join(out,(route==='/'?'entry':'login')+'-wide.png'),fullPage:true})}
 await page.emulateMedia({reducedMotion:'no-preference'});await page.goto(base+'/');assert.equal(await page.locator('.fan-card').first().evaluate(el=>getComputedStyle(el).animationName),'entry-arrive')
 assert.deepEqual(errors,[])
 console.log('Screen fit passed: full-width desktop and mobile application pages, both lobbies, host gameplay, and full-height entry/login screens.')
})().catch(async e=>{console.error(e);await page?.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill()})
