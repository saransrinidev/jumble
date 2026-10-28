import { beforeEach,describe,expect,it,vi } from 'vitest'
import { clearBuilderDraft,duplicateGame,importQuestionRows,parseDelimited,questionImportSample,readBuilderDraft,readQuestionFile,writeBuilderDraft } from './builderTools'
import type { SavedGame } from './dashboardService'

const game:SavedGame={_id:'original',title:'Movie Night',rounds:[{_id:'r1',index:0,name:'Trivia',kind:'text',instructions:'Guess the movie.',questions:[{_id:'q1',kind:'text',prompt:'Who is Simba?',acceptedAnswers:['A lion'],answerSeconds:30,points:10}]}]}
beforeEach(()=>{const values=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)})})
describe('draft recovery and duplication',()=>{
 it('recovers blank-titled unfinished work and keeps users and games separate',()=>{
  const draft={...structuredClone(game),_id:'',title:''};writeBuilderDraft('USER1',draft)
  expect(readBuilderDraft('USER1')?.game).toEqual(draft);expect(readBuilderDraft('USER2')).toBeNull();expect(readBuilderDraft('USER1','original')).toBeNull()
  clearBuilderDraft('USER1');expect(readBuilderDraft('USER1')).toBeNull()
 })
 it('reports storage failure and ignores damaged drafts',()=>{
  vi.stubGlobal('localStorage',{getItem:()=>'{broken',setItem:()=>{throw Error('Quota exceeded')}})
  expect(writeBuilderDraft('USER',game)).toBeNull();expect(readBuilderDraft('USER')).toBeNull()
 })
 it('creates an independent copy with fresh IDs without copying the game ID',()=>{
  const copy=duplicateGame(game);expect(copy._id).toBe('');expect(copy.title).toBe('Movie Night (copy)')
  expect(copy.rounds[0]._id).not.toBe(game.rounds[0]._id);expect(copy.rounds[0].questions[0]._id).not.toBe(game.rounds[0].questions[0]._id)
  copy.rounds[0].questions[0].acceptedAnswers[0]='Changed';expect(game.rounds[0].questions[0].acceptedAnswers).toEqual(['A lion'])
 })
})
describe('question imports',()=>{
 it('reads CSV quoting, escaped quotes, multiline cells, BOM and blank lines',()=>{
  const rows=parseDelimited('\uFEFFquestion,answer\r\n"Say ""hello"", then\ncontinue",yes\r\n\r\n')
  const result=importQuestionRows(rows,'text');expect(result.errors).toEqual([]);expect(result.questions[0].prompt).toBe('Say "hello", then\ncontinue');expect(result.questions).toHaveLength(1)
  expect(()=>parseDelimited('question,answer\n"unfinished,yes')).toThrow(/unclosed/)
 })
 it('supports TSV, numbers, answer variants and default timing',()=>{
  const result=importQuestionRows(parseDelimited('question\tanswer\tpoints\n2+2?\t4|four\t5','\t'),'text')
  expect(result.errors).toEqual([]);expect(result.questions[0].acceptedAnswers).toEqual(['4','four']);expect(result.questions[0].points).toBe(5);expect(result.questions[0].answerSeconds).toBe(30)
 })
 it('checks required columns, MCQ answers, numeric limits and duplicate headers',()=>{
  expect(importQuestionRows([['name'],['Hi']],'text').errors.join()).toContain('question column')
  expect(importQuestionRows([['question','answer','option_a','option_b','seconds'],['Pick','C','A','B',0]],'mcq').errors.join()).toContain('Row 2:')
  expect(importQuestionRows([['question','prompt','answer'],['Hi','Hello','Yes']],'text').errors.join()).toContain('unique')
 })
 it('validates memory grids and accepts all round-specific sample files',()=>{
  for(const kind of ['text','memory','emoji','drawing','mcq'] as const){const result=importQuestionRows(parseDelimited(questionImportSample(kind)),kind);expect(result.errors,kind).toEqual([]);expect(result.questions.length).toBeGreaterThan(0)}
  const bad=importQuestionRows([['question','words','rows','columns'],['Remember','one|two',2,2]],'memory');expect(bad.errors.join()).toContain('fill the grid')
 })
 it('limits row counts, file size and unsupported formats',async()=>{
  expect(importQuestionRows([['question','answer'],...Array.from({length:101},()=>['Q','A'])],'text').errors.join()).toContain('100 questions')
  await expect(readQuestionFile(new File(['x'],'old.xls'),'text')).rejects.toThrow(/xlsx/)
  await expect(readQuestionFile(new File(['x'.repeat(2*1024*1024+1)],'large.csv'),'text')).rejects.toThrow(/2 MB/)
 })
})
