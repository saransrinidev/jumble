const {chromium}=require('playwright'),{spawn}=require('node:child_process')
const {zipSync,strToU8}=require('fflate')
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict')
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:5201',out=path.resolve(root,'../test-artifacts/builder-shortcuts')
let server,browser,page
function workbook(){
 const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',rel='http://schemas.openxmlformats.org/package/2006/relationships'
 const files={
  '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
  '_rels/.rels':`<Relationships xmlns="${rel}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  'xl/workbook.xml':`<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Questions" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  'xl/_rels/workbook.xml.rels':`<Relationships xmlns="${rel}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
  'xl/worksheets/sheet1.xml':`<worksheet xmlns="${ns}"><sheetData>${[['question','answer','seconds','points'],['Who wrote Hamlet?','William Shakespeare',30,15],['What is the largest planet?','Jupiter',20,10]].map((row,i)=>`<row r="${i+1}">${row.map((cell,j)=>typeof cell==='number'?`<c r="${'ABCD'[j]}${i+1}"><v>${cell}</v></c>`:`<c r="${'ABCD'[j]}${i+1}" t="inlineStr"><is><t>${cell}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`
 }
 return Buffer.from(zipSync(Object.fromEntries(Object.entries(files).map(([name,text])=>[name,strToU8(text)]))))
}
;(async()=>{
 fs.mkdirSync(out,{recursive:true})
 server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','5201','--strictPort'],{cwd:root,stdio:['ignore','pipe','pipe']})
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Preview timeout')),20000);server.stdout.on('data',d=>{if(d.toString().includes('5201')){clearTimeout(timer);resolve()}});server.on('exit',c=>reject(Error('Preview exited '+c)))})
 browser=await chromium.launch({headless:true});page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'})
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto(base+'/login');await page.getByLabel('Your user ID').fill('GIPL042');await page.getByRole('button',{name:'Enter dashboard'}).click();await page.waitForURL('**/dashboard')
 await page.getByRole('link',{name:'Create Game',exact:true}).first().click();await page.getByLabel('Game title',{exact:true}).fill('Fast prep original')
 for(const name of ['Memory Grid','Emoji Decode','Draw & Guess'])await page.getByRole('button',{name:'Remove '+name,exact:true}).click()
 await page.getByRole('button',{name:'Add round',exact:true}).click();await page.getByLabel('Round name',{exact:true}).fill('Quick Trivia');await page.getByLabel('Round type',{exact:true}).selectOption('text');await page.getByRole('dialog').getByRole('button',{name:'Add round',exact:true}).click();await page.getByRole('button',{name:'Remove Technical Showdown',exact:true}).click()
 await page.getByRole('button',{name:'Add question',exact:true}).click();await page.getByLabel('Question',{exact:true}).fill('What is 2 + 2?');await page.getByLabel('Accepted answers (one per line)',{exact:true}).fill('4')
 await page.reload();assert.equal(await page.getByLabel('Game title',{exact:true}).inputValue(),'Fast prep original');assert.equal(await page.getByLabel('Question',{exact:true}).inputValue(),'What is 2 + 2?');await page.getByText('Recovered draft saved on this device.',{exact:true}).waitFor()
 const openImport=()=>page.getByRole('button',{name:'Import questions',exact:true}).click()
 const csv={name:'trivia.csv',mimeType:'text/csv',buffer:Buffer.from('question,answer,seconds,points\r\n"Which movie features Simba?","The Lion King|Lion King",30,10\r\n"What is the capital of France?",Paris,20,15')}
 await openImport();const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download sample',exact:true}).click();const download=await downloadPromise;assert.equal(download.suggestedFilename(),'jumble-text-questions.csv')
 await page.getByLabel('Question file',{exact:true}).setInputFiles(csv);await page.getByRole('heading',{name:'2 of 2 questions ready'}).waitFor();await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await page.locator('.editor-question').count(),1)
 await openImport();await page.getByLabel('Question file',{exact:true}).setInputFiles(csv);await page.getByRole('button',{name:'Import 2 questions',exact:true}).click();assert.equal(await page.locator('.editor-question').count(),3)
 await openImport();await page.getByLabel('Question file',{exact:true}).setInputFiles({name:'bad.csv',mimeType:'text/csv',buffer:Buffer.from('question,answer,seconds\nBad question,,0')});await page.getByText(/Row 2:.*answer is required/).waitFor();assert.equal(await page.getByRole('button',{name:'Import 0 questions',exact:true}).isDisabled(),true);await page.getByRole('button',{name:'Cancel',exact:true}).click()
 await openImport();await page.getByLabel('Question file',{exact:true}).setInputFiles({name:'questions.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:workbook()});await page.getByRole('heading',{name:'2 of 2 questions ready'}).waitFor();await page.screenshot({path:path.join(out,'xlsx-preview.png'),fullPage:true});await page.getByRole('button',{name:'Import 2 questions',exact:true}).click();assert.equal(await page.locator('.editor-question').count(),5)
 await page.getByRole('button',{name:'Save game',exact:true}).click();await page.getByText('Game saved. Choose it from Host Game on your dashboard.',{exact:true}).waitFor()
 const original=await page.evaluate(()=>JSON.parse(localStorage.getItem('jumble.mock.templates'))[0]);assert.equal(original.rounds[0].questions.length,5)
 await page.waitForURL(/\/create\?id=/)
 await page.getByLabel('Question',{exact:true}).first().fill('Unfinished saved-game edit')
 await page.reload();assert.equal(await page.getByLabel('Question',{exact:true}).first().inputValue(),'Unfinished saved-game edit')
 await page.getByLabel('Question',{exact:true}).first().fill(original.rounds[0].questions[0].prompt)
 await page.getByRole('button',{name:'Save game',exact:true}).click();await page.getByText('Game saved. Choose it from Host Game on your dashboard.',{exact:true}).waitFor()
 await page.getByRole('link',{name:'My games',exact:true}).click();await page.getByRole('button',{name:'Duplicate',exact:true}).click();await page.waitForURL(/\/create\?id=/)
 assert.equal(await page.getByLabel('Game title',{exact:true}).inputValue(),'Fast prep original (copy)');assert.equal(await page.locator('.editor-question').count(),5)
 await page.getByLabel('Question',{exact:true}).first().fill('Changed copy question');await page.reload();assert.equal(await page.getByLabel('Question',{exact:true}).first().inputValue(),'Changed copy question')
 await page.getByRole('button',{name:'Save game',exact:true}).click();await page.getByText('Game saved. Choose it from Host Game on your dashboard.',{exact:true}).waitFor()
 const templates=await page.evaluate(()=>JSON.parse(localStorage.getItem('jumble.mock.templates')));const source=templates.find(g=>g._id===original._id),copy=templates.find(g=>g._id!==original._id)
 assert.deepEqual(source,original);assert.notEqual(copy.rounds[0]._id,source.rounds[0]._id);assert.notEqual(copy.rounds[0].questions[0]._id,source.rounds[0].questions[0]._id)
 await page.setViewportSize({width:390,height:844});await openImport();await page.getByLabel('Question file',{exact:true}).setInputFiles(csv);await page.getByRole('heading',{name:'2 of 2 questions ready'}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join(out,'import-mobile.png'),fullPage:true});await page.getByRole('button',{name:'Cancel',exact:true}).click()
 assert.deepEqual(errors,[])
 console.log('Builder shortcuts passed: draft recovery, CSV/XLSX imports, sample download, error handling, cancel, duplicate independence, saved copies, and mobile import preview.')
})().catch(async e=>{console.error(e);await page?.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill()})
