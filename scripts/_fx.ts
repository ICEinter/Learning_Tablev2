import { createFixtureWithSolution, FIXTURE_KINDS } from "@/data/fixtures";
import { precheck, validate } from "@/engine";
for (const k of FIXTURE_KINDS) {
  const t = Date.now();
  const { dataset: ds, solution } = createFixtureWithSolution(k, 1);
  const tg = Date.now() - t;
  const per = ds.assignments.reduce((s, a) => s + (a.blockSizes?.reduce((x, y) => x + y, 0) ?? ds.courses.find(c => c.id === a.courseId)!.periodsPerWeek), 0);
  const t2 = Date.now();
  const pr = precheck(ds);
  const tp = Date.now() - t2;
  let sol = "";
  if (solution) { const t3 = Date.now(); const v = validate(ds, solution); sol = `planted hard=${v.score.hard} (${Date.now()-t3}ms) ${v.violations.filter(x=>x.severity==='hard').slice(0,3).map(x=>x.message).join(' | ')}`; }
  console.log(k, `gen ${tg}ms groups ${ds.groups.length} teachers ${ds.teachers.length} rooms ${ds.rooms.length} asg ${ds.assignments.length} periods ${per} students ${ds.students.length} extras ${ds.students.filter(s=>s.extraAssignmentIds.length).length}`, `precheck ${tp}ms rules ${[...new Set(pr.map(p => p.rule))].join(",")}`, sol);
}
