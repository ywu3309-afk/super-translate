'use strict';
const assert=require('node:assert/strict');
const Core=require('../src/text-core');

const source='DINO 120 个学分，12 个学分等于 6 个月，最低 1 个学分价格是 200。';
const protectedText=Core.protect(source);
const reordered='DINO zxq KEEP 0 0 0 4 qxz 个学分，ZXQ KEEP 0 0 0 0 QXZ 个学分等于 ZXQKEEP0002QXZ 个月，最低 ZXQKEEP0001QXZ 个学分价格是 ZXQKEEP0003QXZ。';

assert.equal(
  Core.restore(reordered,protectedText.values),
  'DINO 200 个学分，120 个学分等于 6 个月，最低 12 个学分价格是 1。'
);
assert.throws(
  ()=>Core.restore(reordered.replace('ZXQKEEP0002QXZ','ZXQKEEP0001QXZ'),protectedText.values),
  /受保护/
);
assert.throws(
  ()=>Core.restore(`${reordered} ZXQKEEP9999QXZ`,protectedText.values),
  /保护标记/
);
console.log(JSON.stringify({ok:true,checks:3}));
