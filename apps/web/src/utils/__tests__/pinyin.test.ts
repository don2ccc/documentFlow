import { describe, expect, it } from 'vitest';
import { splitNamePinyin } from '../pinyin';

describe('splitNamePinyin', () => {
  it('拆出姓和名', () => {
    expect(splitNamePinyin('杨德安')).toEqual({ surname: 'Yang', given: "De'an" });
    expect(splitNamePinyin('张伟')).toEqual({ surname: 'Zhang', given: 'Wei' });
    expect(splitNamePinyin('王小明')).toEqual({ surname: 'Wang', given: 'Xiaoming' });
  });

  it('只有姓没有名时，名为空', () => {
    expect(splitNamePinyin('李')).toEqual({ surname: 'Li', given: '' });
  });

  it('识别复姓', () => {
    expect(splitNamePinyin('欧阳修')).toEqual({ surname: 'Ouyang', given: 'Xiu' });
    expect(splitNamePinyin('司马相如')).toEqual({ surname: 'Sima', given: 'Xiangru' });
    expect(splitNamePinyin('诸葛云帆')).toEqual({ surname: 'Zhuge', given: 'Yunfan' });
    expect(splitNamePinyin('万俟卨')).toEqual({ surname: 'Moqi', given: 'Xie' });
  });

  it('多音姓取姓氏读音', () => {
    expect(splitNamePinyin('单雄信')).toEqual({ surname: 'Shan', given: 'Xiongxin' });
    expect(splitNamePinyin('曾国藩')).toEqual({ surname: 'Zeng', given: 'Guofan' });
    expect(splitNamePinyin('乐思慧')).toEqual({ surname: 'Yue', given: 'Sihui' });
    expect(splitNamePinyin('区楚良')).toEqual({ surname: 'Ou', given: 'Chuliang' });
  });

  it('单字姓不会被误判成复姓', () => {
    // 「万丽」的首两字不构成复姓，按单字姓处理
    expect(splitNamePinyin('万丽')).toEqual({ surname: 'Wan', given: 'Li' });
  });

  it('非中文输入返回空串', () => {
    expect(splitNamePinyin('Billy')).toEqual({ surname: '', given: '' });
    expect(splitNamePinyin('')).toEqual({ surname: '', given: '' });
    expect(splitNamePinyin('   ')).toEqual({ surname: '', given: '' });
  });

  it('忽略空格与间隔号', () => {
    expect(splitNamePinyin(' 杨 德安 ')).toEqual({ surname: 'Yang', given: "De'an" });
    expect(splitNamePinyin('买买提·艾力')).toEqual({ surname: 'Mai', given: "Maiti'aili" });
  });

  it('未知汉字跳过而不是崩溃', () => {
    expect(() => splitNamePinyin('龘䶮')).not.toThrow();
  });
});