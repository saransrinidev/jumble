import type { SavedGame,SavedQuestion } from './dashboardService'

export interface BuilderDraft { version:1; game:SavedGame; savedAt:string }
const draftKey=(userId:string,id='')=>`jumble.builder.draft.${encodeURIComponent(userId)}.${encodeURIComponent(id||'new')}`
export function readBuilderDraft(userId:string,id=''):BuilderDraft|null{
 try{const draft=JSON.parse(localStorage.getItem(draftKey(userId,id))||'null');return draft?.version===1&&typeof draft.game?.title==='string'&&draft.game._id===id&&Array.isArray(draft.game.rounds)&&draft.game.rounds.length>0&&draft.game.rounds.length<=20&&draft.game.rounds.every((r:{_id?:unknown;name?:unknown;questions?:SavedQuestion[]})=>typeof r?._id==='string'&&typeof r.name==='string'&&Array.isArray(r.questions)&&r.questions.every(q=>typeof q?._id==='string'&&typeof q.prompt==='string'&&Array.isArray(q.acceptedAnswers)))?draft:null}catch{return null}
}
export function writeBuilderDraft(userId:string,game:SavedGame):BuilderDraft|null{
 const draft:BuilderDraft={version:1,game:structuredClone(game),savedAt:new Date().toISOString()}
 try{localStorage.setItem(draftKey(userId,game._id),JSON.stringify(draft));return draft}catch{return null}
}
export function clearBuilderDraft(userId:string,id=''){try{localStorage.removeItem(draftKey(userId,id))}catch{}}
export function duplicateGame(source:SavedGame):SavedGame{
 return {_id:'',title:`${source.title.slice(0,93)} (copy)`,rounds:source.rounds.map((r,index)=>({...structuredClone(r),_id:crypto.randomUUID(),index,questions:r.questions.map(q=>({...structuredClone(q),_id:crypto.randomUUID()}))}))}
}
export interface QuestionImport { questions:SavedQuestion[]; errors:string[]; rowCount:number }
export function parseDelimited(text:string,delimiter=','):string[][]{
 const rows:string[][]=[];let row:string[]=[],value='',quoted=false,closedQuote=false
 text=text.replace(/^\uFEFF/,'')
 for(let i=0;i<text.length;i++){
  const c=text[i]
  if(quoted){if(c==='"'){if(text[i+1]==='"'){value+='"';i++}else{quoted=false;closedQuote=true}}else value+=c;continue}
  if(c==='"'){if(value||closedQuote)throw new Error('Invalid CSV quotation. Use double quotes around cells containing commas or line breaks.');quoted=true;continue}
  if(c===delimiter){row.push(value);value='';closedQuote=false;continue}
  if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);rows.push(row);row=[];value='';closedQuote=false;continue}
  if(closedQuote&&c.trim())throw new Error('Unexpected text after a quoted CSV cell.')
  if(!closedQuote)value+=c
 }
 if(quoted)throw new Error('The CSV has an unclosed quoted cell.')
 if(value||row.length||closedQuote){row.push(value);rows.push(row)}
 return rows
}
const list=(value:string)=>value.split(/\||\r?\n/).map(s=>s.trim()).filter(Boolean)
export function importQuestionRows(input:unknown[][],kind:SavedQuestion['kind']):QuestionImport{
 const nonempty=(row:unknown[])=>row.some(c=>c!==null&&c!==undefined&&String(c).trim())
 const first=input.findIndex(nonempty),rows=first>=0?input.slice(first):[]
 const data=rows.slice(1).map((row,index)=>({row,line:first+index+2})).filter(({row})=>nonempty(row))
 if(!rows.length||!data.length)return {questions:[],errors:['Include a header row and at least one question.'],rowCount:0}
 const aliases:Record<string,string>={prompt:'question',accepted_answers:'answer',correct_answer:'answer',answer_seconds:'seconds',duration:'seconds',cols:'columns',show_seconds:'memorize_seconds'}
 const headers=rows[0].map(c=>{const name=String(c??'').trim().toLowerCase().replace(/[\s-]+/g,'_');return aliases[name]||name})
 const errors:string[]=[],questions:SavedQuestion[]=[]
 if(!headers.includes('question'))errors.push('Missing the question column. Download the sample file for the correct format.')
 if(kind!=='memory'&&!headers.includes('answer'))errors.push('Missing the answer column.')
 if(new Set(headers.filter(Boolean)).size!==headers.filter(Boolean).length)errors.push('Column headers must be unique.')
 if(data.length>100)errors.push('Import at most 100 questions at a time.')
 if(errors.length)return {questions,errors,rowCount:data.length}
 data.forEach(({row,line})=>{
  const values:Record<string,string>={};headers.forEach((h,i)=>{values[h]=String(row[i]??'').trim()})
  const rowErrors:string[]=[],prompt=values.question,answers=list(values.answer||'')
  const number=(field:string,fallback:number,min:number,max:number,integer=false)=>{const value=values[field]?Number(values[field]):fallback;if(!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isInteger(value)))rowErrors.push(`${field} must be ${integer?'a whole number ':''}between ${min} and ${max}`);return value}
  if(!prompt)rowErrors.push('question is required')
  if(prompt.length>4000)rowErrors.push('question must be 4,000 characters or less')
  if(kind!=='memory'&&!answers.length)rowErrors.push('answer is required')
  if(answers.some(a=>a.length>4000))rowErrors.push('answers must be 4,000 characters or less')
  const question:SavedQuestion={_id:crypto.randomUUID(),kind,prompt,acceptedAnswers:answers,answerSeconds:number('seconds',30,1,300),points:number('points',10,0,1000)}
  if(kind==='mcq'){
   const options=values.options?list(values.options):['option_a','option_b','option_c','option_d','option_e','option_f','option_g','option_h'].map(h=>values[h]).filter(Boolean)
   if(options.length<2)rowErrors.push('provide at least two choices in option_a, option_b, etc., or options')
   if(options.length>8||new Set(options).size!==options.length)rowErrors.push('provide up to eight different choices')
   if(answers.some(a=>!options.includes(a)))rowErrors.push('each answer must exactly match one of the choices')
   question.options=options;if(values.code)question.code=values.code
  }
  if(kind==='memory'){
   const words=list(values.words||'');question.words=words;question.rows=number('rows',5,1,10,true);question.cols=number('columns',5,1,10,true);question.showSeconds=number('memorize_seconds',10,1,120)
   if(!words.length||words.length!==question.rows*question.cols)rowErrors.push('words must fill the grid exactly (rows × columns)')
   if(words.some(w=>w.length>100))rowErrors.push('each grid word must be 100 characters or less')
  }
  if(values.image){if(!/^(https?:\/\/|\/)/i.test(values.image))rowErrors.push('image must be a website URL or start with /');question.image=values.image}
  if(rowErrors.length)errors.push(`Row ${line}: ${rowErrors.join('; ')}.`);else questions.push(question)
 })
 return {questions,errors,rowCount:data.length}
}
export async function readQuestionFile(file:File,kind:SavedQuestion['kind']):Promise<QuestionImport>{
 if(file.size>2*1024*1024)throw new Error('Choose a file smaller than 2 MB.')
 const extension=file.name.split('.').pop()?.toLowerCase();let rows:unknown[][]
 if(extension==='xlsx'){const {readSheet}=await import('read-excel-file/browser');rows=await readSheet(file)}
 else if(extension==='csv'||extension==='tsv')rows=parseDelimited(await file.text(),extension==='tsv'?'\t':',')
 else throw new Error('Choose an .xlsx, .csv, or .tsv file. Save older Excel files as .xlsx first.')
 return importQuestionRows(rows,kind)
}
export function questionImportSample(kind:SavedQuestion['kind']):string{
 const header=['question','answer','option_a','option_b','option_c','option_d','seconds','points','words','rows','columns','memorize_seconds','image']
 const samples=kind==='memory'?[['Remember these four words','','','','','',30,10,'Apple|River|Moon|Chair',2,2,10,'']]:kind==='mcq'?[['Which planet is known as the Red Planet?','Mars','Venus','Mars','Jupiter','Earth',30,10,'','','','',''],['What is 2 + 2?','4','3','4','5','6',30,10,'','','','','']]:kind==='drawing'?[['Rocket ship','Rocket ship','','','','',30,10,'','','','',''],['Umbrella','Umbrella','','','','',30,10,'','','','','']]:kind==='emoji'?[['🦁👑','The Lion King|Lion King','','','','',30,10,'','','','','']]:[['Which movie features Simba?','The Lion King|Lion King','','','','',30,10,'','','','',''],['What is the capital of France?','Paris','','','','',30,10,'','','','','']]
 const cell=(v:unknown)=>`"${String(v).replace(/"/g,'""')}"`
 return '\uFEFF'+[header,...samples].map(row=>row.map(cell).join(',')).join('\r\n')
}
