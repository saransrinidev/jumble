const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const { pathToFileURL } = require('node:url')
const path = require('node:path')
;(async()=>{
  const browser=await chromium.launch({headless:true})
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'})
    const errors=[], external=[]
    page.on('pageerror',e=>errors.push(e.message))
    page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url())})
    const url=pathToFileURL(path.resolve(__dirname,'../../designs/jumble-design.html')).href
    await page.goto(url+'#dashboard')
    await page.getByRole('heading',{name:'Your team. Your next big win.'}).waitFor()
    await page.getByRole('button',{name:'Host Game',exact:true}).click()
    await page.getByRole('button',{name:'Open host lobby'}).click()
    await page.waitForURL(/#host$/)
    await page.getByRole('button',{name:'Start Game',exact:true}).waitFor()
    for(const screen of ['enter','login','dashboard','lobby','host','results','history','games','build','profile','settings']) {
      await page.goto(url+'#'+screen)
      await page.setViewportSize({width:390,height:844})
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,screen+' mobile width')
      const missing=await page.locator('#app img').evaluateAll(imgs=>imgs.filter(img=>img.complete&&!img.naturalWidth).map(img=>img.src.slice(0,50)))
      assert.deepEqual(missing,[],screen+' images')
    }
    assert.deepEqual(errors,[])
    assert.deepEqual(external,[])
    console.log('Standalone HTML passed: opens from file, hosting works, all 11 screens fit mobile, and no external requests are made.')
  } finally { await browser.close() }
})().catch(e=>{console.error(e);process.exitCode=1})
