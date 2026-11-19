export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export function buildRound(lessons, country, level, random = Math.random) {
  if (![1, 2, 3].includes(level)) throw new Error('Nivel no válido');
  const categories = lessons.filter(item => item.country === country);
  if (categories.length < 3 || categories.some(item => !item.objects?.length)) throw new Error('Faltan categorías u objetos');
  return { level, country, index: 0, score: 0, answered: false, finished: false,
    questions: shuffle(categories, random).slice(0, 6).map(lesson => ({
      item: lesson.objects[Math.floor(random() * lesson.objects.length)],
      correct: lesson.id,
      choices: shuffle([lesson, ...shuffle(categories.filter(other => other.id !== lesson.id), random).slice(0, level === 3 ? 5 : 2)], random)
    })) };
}
export function answerRound(round, categoryId) {
  if (round.finished || round.answered) return null;
  const question = round.questions[round.index];
  if (!question.choices.some(choice => choice.id === categoryId)) return null;
  round.answered = true;
  const correct = question.correct === categoryId;
  if (correct) round.score++;
  return correct;
}
export function nextQuestion(round) {
  if (!round.answered || round.finished) return false;
  round.index++; round.answered = false;
  if (round.index >= round.questions.length) round.finished = true;
  return true;
}
export const sameAnswers = (selected, correct) => selected.length === correct.length && [...new Set(selected)].length === selected.length && correct.every(id => selected.includes(id));
