import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {buildRound,answerRound,nextQuestion,sameAnswers} from '../public/game.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=JSON.parse(readFileSync(path.join(root,'public/data/content.json'),'utf8'));

for(const country of ['BO','GU'])for(const level of [1,2,3])test(`Reto ${level} / ${country}: seis objetos distintos, puntuación única y finalización`,()=>{
  const round=buildRound(data.lessons,country,level);
  assert.equal(round.questions.length,6);assert.equal(new Set(round.questions.map(q=>q.item.id)).size,6);
  assert.equal(nextQuestion(round),false);
  for(const q of round.questions){
    assert.equal(q.choices.length,level===3?6:3);assert.equal(q.choices.filter(c=>c.id===q.correct).length,1);
    assert.ok(q.choices.every(c=>c.country===country));
    assert.equal(answerRound(round,q.correct),true);assert.equal(answerRound(round,q.correct),null);assert.equal(nextQuestion(round),true);
  }
  assert.equal(round.score,6);assert.equal(round.finished,true);assert.equal(nextQuestion(round),false);assert.equal(answerRound(round,'anything'),null);
});
test('Una respuesta incorrecta no suma; cancelar arrastre no modifica el estado',()=>{
 const r=buildRound(data.lessons,'BO',3);const q=r.questions[0];const before=JSON.stringify(r);
 assert.equal(answerRound(r,'invalid-category'),null);assert.equal(JSON.stringify(r),before);
 assert.equal(answerRound(r,q.choices.find(c=>c.id!==q.correct).id),false);assert.equal(r.score,0);
});
test('Las preguntas múltiples requieren exactamente el conjunto correcto',()=>{
 assert.equal(sameAnswers(['a','c'],['c','a']),true);assert.equal(sameAnswers(['a'],['a','c']),false);
 assert.equal(sameAnswers(['a','a'],['a','c']),false);assert.equal(sameAnswers(['a','b','c'],['a','c']),false);
 assert.equal(data.rights.questions.filter(q=>q.multiple).length,2);
});
test('Todos los recursos locales referenciados existen y las preguntas son coherentes',()=>{
 const paths=new Set();function walk(v){if(typeof v==='string'&&v.startsWith('/assets/'))paths.add(v);else if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')Object.values(v).forEach(walk);}walk(data);
 assert.ok(paths.size>=100);for(const p of paths)assert.ok(existsSync(path.join(root,'public',p)),p);
 assert.equal(data.lessons.length,12);assert.equal(data.lessons.flatMap(v=>v.objects).length,72);
 for(const q of data.rights.questions){assert.ok(q.correct.length);assert.ok(q.correct.every(id=>q.options.some(o=>o.id===id)));}
});
