import { ReduceInfo, ReduceMatchInfo, SerializedParserTable } from "./serialization.js";

type MinifiedTransition = [
  string | number | null, // under
  number, // read
  number, // index
];

type MinifiedParserState = [
  number, // isAccepting
  MinifiedTransition[],
];

type MinifiedReduceNonmatchInfo = [
  number, // popCount
  number, // reduceInto
];

type MinifiedReduceMatchInfo = [
  number, // popCount
  number, // reduceInto
  string, // prop
  number, // isArrayMatch, 0 or 1
  ...ReduceMatchInfo['type'],
];

type MinifiedReduceInfo = MinifiedReduceNonmatchInfo | MinifiedReduceMatchInfo;

export type MinifiedParserTable = {
  s: MinifiedParserState[];
  r: Record<string, MinifiedReduceInfo>;
};

export const minifyParserTable = (table: SerializedParserTable): MinifiedParserTable => {
  return {
    s: table.states.map(
      (state) => [
        state.isAccepting ? 1 : 0,
        state.transitions.map(
          (transition) => [
            transition.under,
            transition.action.read ? 1 : 0,
            transition.action.index,
          ],
        ),
      ],
    ),
    r: (Object.keys(table.reduceInfos) as (keyof typeof table.reduceInfos)[])
      .reduce<Record<string, MinifiedReduceInfo>>(
        (acc, key) => {
          const reduceInfo = table.reduceInfos[key];
          
          acc[key] = reduceInfo.prop === null ? ([
            reduceInfo.popCount,
            reduceInfo.reduceInto,
          ]) : ([
            reduceInfo.popCount,
            reduceInfo.reduceInto,
            reduceInfo.prop,
            reduceInfo.isArrayMatch ? 1 : 0,
            ...reduceInfo.type,
          ]);
          
          return acc;
        },
        {},
      ),
  };
};

export const deminifyParserTable = (table: MinifiedParserTable): SerializedParserTable => {
  return {
    states: table.s.map(
      (state) => ({
        isAccepting: state[0] === 1,
        transitions: state[1].map(
          (transition) => ({
            under: transition[0],
            action: {
              read: transition[1] === 1,
              index: transition[2],
            },
          }),
        ),
      }),
    ),
    reduceInfos: (Object.keys(table.r) as (keyof typeof table.r)[])
      .reduce<Record<string, ReduceInfo>>(
        (acc, key) => {
          const reduceInfo = table.r[key];
          
          acc[key] = reduceInfo.length === 2 ? ({
            popCount: reduceInfo[0],
            reduceInto: reduceInfo[1],
            prop: null,
          }) : ({
            popCount: reduceInfo[0],
            reduceInto: reduceInfo[1],
            prop: reduceInfo[2],
            isArrayMatch: reduceInfo[3] === 1,
            type: reduceInfo.slice(4) as ReduceMatchInfo['type'],
          });
          
          return acc;
        },
        {},
      ),
  };
};
