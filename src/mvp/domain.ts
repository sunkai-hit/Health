/** Sprint S1: input validation for synthetic local-only event/symptom API.
 * No disease identification, risk scoring, clinical recommendations, or medication API.
 */
export type BodyView = 'front' | 'back';
export type BodyMark = {
  view: BodyView;
  zone_code: string;
  segment_code: string | null;
};
export type EventInput = {
  title: string;
  onset_at: string | null;
  onset_precision: 'exact' | 'approximate' | 'unknown';
};
export type SymptomInput = {
  occurred_at: string | null;
  occurred_precision: 'exact' | 'approximate' | 'unknown';
  symptoms: string[];
  severity: number | null;
  narrative: string;
  body_marks: BodyMark[];
  radiation: { from_index: number; to_index: number } | null;
};
export class InputError extends Error {
  readonly status = 422;
  constructor(public readonly code: string, message: string) { super(message); }
}
const ZONES: Record<BodyView, ReadonlySet<string>> = {
  front: new Set([
    'head','neck','shoulder-right','shoulder-left','chest-right','chest-left',
    'upper-abd','navel','lower-abd-right','lower-abd-left',
    'arm-right','arm-left','hand-right','hand-left',
    'thigh-right','thigh-left','calf-right','calf-left'
  ]),
  back: new Set([
    'head-back','neck-back','shoulder-right-back','shoulder-left-back',
    'upper-back-right','upper-back-left','lumbar-right','lumbar-left',
    'arm-right-back','arm-left-back','hand-right-back','hand-left-back',
    'thigh-right-back','thigh-left-back','calf-right-back','calf-left-back'
  ])
};
const SEGMENTS: Record<string, ReadonlySet<string>> = {
  'front:upper-abd': new Set(['upper-abd-center','left-upper-abd','right-upper-abd']),
  'front:head': new Set(['forehead','top-head','left-temple','right-temple','face']),
  'front:lower-abd-right': new Set(['right-lower-inner','right-lower-outer']),
  'front:lower-abd-left': new Set(['left-lower-inner','left-lower-outer']),
  'back:lumbar-right': new Set(['right-lumbar','right-flank']),
  'back:lumbar-left': new Set(['left-lumbar','left-flank'])
};
function obj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new InputError('INVALID_BODY', '提交的数据必须是对象');
  return v as Record<string, unknown>;
}
function onlyKeys(value: Record<string, unknown>, allowed: string[]) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new InputError('UNSUPPORTED_FIELD', '包含本阶段不支持的字段');
  }
}
function txt(v: unknown, max: number, label: string, optional = false) {
  if (optional && (v === undefined || v === null)) return '';
  if (typeof v !== 'string' || v.trim().length > max || (!optional && !v.trim())) {
    throw new InputError('INVALID_FIELD', label + '格式不正确');
  }
  return v.trim();
}
function dateAndPrecision(v: unknown, p: unknown) {
  const value = v === undefined || v === null || v === '' ? null : v;
  if (value !== null && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || Number.isNaN(Date.parse(value)))) {
    throw new InputError('INVALID_TIMESTAMP', '时间须包含时区，或明确为未知');
  }
  const precision = p ?? (value === null ? 'unknown' : 'exact');
  if (!['exact','approximate','unknown'].includes(String(precision)) || (value === null && precision !== 'unknown') || (value !== null && precision === 'unknown')) {
    throw new InputError('INVALID_PRECISION', '时间精度与时间值不一致');
  }
  return { at: value as string | null, precision: precision as 'exact'|'approximate'|'unknown' };
}
export function parseEvent(v: unknown): EventInput {
  const o = obj(v);
  onlyKeys(o, ['title','onset_at','onset_precision']);
  const {at,precision} = dateAndPrecision(o.onset_at, o.onset_precision);
  return {title: txt(o.title, 80, '健康事件标题'), onset_at:at, onset_precision:precision};
}
export function parseSymptom(v: unknown): SymptomInput {
  const o = obj(v);
  onlyKeys(o, ['kind','occurred_at','occurred_precision','symptoms','severity','narrative','body_marks','radiation']);
  if (o.kind !== undefined && o.kind !== 'symptom') throw new InputError('UNSUPPORTED_ENTRY', 'S1 只支持症状记录');
  const {at,precision} = dateAndPrecision(o.occurred_at, o.occurred_precision);
  if (o.symptoms !== undefined && (!Array.isArray(o.symptoms) || o.symptoms.length > 8)) throw new InputError('INVALID_SYMPTOMS','症状标签最多8项');
  const symptoms = (o.symptoms ?? []) as unknown[];
  if (!Array.isArray(symptoms)) throw new InputError('INVALID_SYMPTOMS','症状标签不正确');
  const labels = symptoms.map(x => txt(x,40,'症状标签'));
  if (new Set(labels).size !== labels.length) throw new InputError('INVALID_SYMPTOMS','症状标签不可重复');
  const severity = o.severity === undefined || o.severity === null ? null : o.severity;
  if (severity !== null && (typeof severity !== 'number' || !Number.isInteger(severity) || severity < 0 || severity > 10)) {
    throw new InputError('INVALID_SEVERITY','程度应为0至10的整数或未知');
  }
  const narrative = txt(o.narrative, 1500,'描述内容',true);
  const marksValue = o.body_marks ?? [];
  if (!Array.isArray(marksValue) || marksValue.length > 8) throw new InputError('INVALID_BODY_MARKS','人体位置最多8个');
  const marks = marksValue.map(x => {
    const mark = obj(x);
    onlyKeys(mark,['view','zone_code','segment_code']);
    const view = mark.view;
    const zone = mark.zone_code;
    const segment = mark.segment_code ?? null;
    if ((view !== 'front' && view !== 'back') || typeof zone !== 'string' || !ZONES[view].has(zone)) {
      throw new InputError('INVALID_BODY_MARK','人体图区域无效');
    }
    if (segment !== null && (typeof segment !== 'string' || !SEGMENTS[view+':'+zone]?.has(segment))) {
      throw new InputError('INVALID_SEGMENT','二级区域不属于所选身体部位');
    }
    return {view,zone_code:zone,segment_code:segment} satisfies BodyMark;
  });
  if (new Set(marks.map(x => x.view+':'+x.zone_code+':'+x.segment_code)).size !== marks.length) throw new InputError('DUPLICATE_BODY_MARK','人体部位不可重复');
  let radiation: SymptomInput['radiation'] = null;
  if (o.radiation !== undefined && o.radiation !== null) {
    const r = obj(o.radiation);
    onlyKeys(r,['from_index','to_index']);
    const a = r.from_index,b = r.to_index;
    if (!Number.isInteger(a) || !Number.isInteger(b) || a === b || (a as number)<0 || (b as number)<0 || (a as number)>=marks.length || (b as number)>=marks.length) {
      throw new InputError('INVALID_RADIATION','延伸方向须引用两个不同的已选部位');
    }
    radiation = {from_index:a as number,to_index:b as number};
  }
  if (!labels.length && !marks.length && !narrative) throw new InputError('EMPTY_SYMPTOM','请至少填写一个症状、位置或说明');
  return {occurred_at:at,occurred_precision:precision,symptoms:labels,severity:severity as number|null,narrative,body_marks:marks,radiation};
}
