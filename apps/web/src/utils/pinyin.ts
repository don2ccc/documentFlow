import charToPinyin, { COMPOUND_SURNAMES, SURNAME_OVERRIDE } from './pinyinData';

/**
 * 中文姓名 -> 拼音（姓 / 名分开）。
 *
 * 供员工档案的「拼音姓」「拼音名」自动推导使用：
 * 输入中文姓名后自动填入，不再要求人工填写。
 *
 * 规则：
 *  - 姓：优先匹配复姓（欧阳 / 司马 ...），否则取首字
 *  - 名：其余字按每字读音拼接，用 ' 分隔音节（德安 -> De'an），避免 De'an 被读成 Dean
 *  - 多音姓取姓氏读音（单 shan、曾 zeng、乐 yue、区 ou ...）
 *  - 不含中文时返回空串，由调用方决定如何处理
 */

export interface NamePinyin {
  surname: string;
  given: string;
}

const CJK = /[一-龥]/;

/** 首个字母大写，其余小写（De'an / Ouyang / Yang） */
function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s;
}

/** 取字符串里的汉字（忽略空格、连字符、· 等） */
function cjkOnly(s: string): string[] {
  return [...s].filter((c) => CJK.test(c));
}

/**
 * 把一组汉字转成连写拼音。
 *
 * 撇号只加在以 a/e/o 开头的音节前——这是《汉语拼音方案》的惯例，
 * 目的是避免歧义：小明 Xiaoming（xiao+ming 连写没问题）、
 * 德安 De'an（否则 De'an 会被读成 Dean 一个词）。
 */
function joinSyllables(chars: string[]): string {
  const parts = chars.map((c) => charToPinyin(c)).filter(Boolean);
  if (parts.length === 0) return '';
  let out = parts[0];
  for (let i = 1; i < parts.length; i++) {
    out += ('aeo'.includes(parts[i][0]) ? "'" : '') + parts[i];
  }
  return capitalize(out);
}

/**
 * 由中文姓名推导拼音姓与拼音名。
 *
 * @example
 * splitNamePinyin('杨德安') // { surname: 'Yang', given: "De'an" }
 * splitNamePinyin('欧阳修')  // { surname: 'Ouyang', given: 'Xiu' }
 * splitNamePinyin('单雄信')  // { surname: 'Shan', given: "Xiong'xin" }
 * splitNamePinyin('Billy')   // { surname: '', given: '' }
 */
export function splitNamePinyin(name: string): NamePinyin {
  const chars = cjkOnly((name ?? '').trim());
  if (chars.length === 0) return { surname: '', given: '' };

  // 复姓优先（复姓表都是双字，先试 2 字，命中则姓占前两字）
  const head2 = chars.slice(0, 2).join('');
  let surname: string;
  let rest: string[];
  if (chars.length >= 2 && COMPOUND_SURNAMES[head2]) {
    surname = COMPOUND_SURNAMES[head2];
    rest = chars.slice(2);
  } else {
    const ch = chars[0];
    surname = SURNAME_OVERRIDE[ch] ?? charToPinyin(ch);
    rest = chars.slice(1);
  }

  return { surname: capitalize(surname), given: joinSyllables(rest) };
}

export default splitNamePinyin;