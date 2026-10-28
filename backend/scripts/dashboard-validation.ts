import assert from 'node:assert/strict'
import { defaultRounds } from '../src/lib/content'
import { roundsSchema, validateRounds } from '../src/lib/templates'

const defaults = defaultRounds()
assert.equal(validateRounds(defaults).length, 4)
assert.equal(validateRounds([structuredClone(defaults[0])]).length,1,'A game may contain one selected round')
const quiz={_id:'quiz',index:0,name:'Movie Trivia',kind:'text' as const,instructions:'Answer the question.',questions:[{_id:'quiz1',kind:'text' as const,prompt:'Who is Simba?',acceptedAnswers:['A lion'],answerSeconds:30,points:10}]}
assert.equal(validateRounds([quiz])[0].name,'Movie Trivia')
const draft = structuredClone(defaults)
draft[0].questions = []
assert.equal(roundsSchema.safeParse(draft).success, true, 'Incomplete drafts can be saved')
assert.throws(() => validateRounds(draft), /Every round needs/)
const duplicates = structuredClone(defaults)
duplicates[1].questions[0]._id = duplicates[0].questions[0]._id
assert.throws(() => validateRounds(duplicates), /unique/)
const invalidChoice = structuredClone(defaults)
invalidChoice[3].questions[0].acceptedAnswers = ['Not a choice']
assert.throws(() => validateRounds(invalidChoice), /Complete each question/)
const invalidTiming = structuredClone(defaults)
invalidTiming[0].questions[0].answerSeconds = -1
assert.throws(() => validateRounds(invalidTiming), /times/)
const wrongGrid = structuredClone(defaults)
wrongGrid[0].questions[0].words = ['One']
assert.throws(() => validateRounds(wrongGrid), /Complete each question/)
console.log('Saved game validation passed: defaults, drafts, IDs, answers, timing, and memory grids.')
