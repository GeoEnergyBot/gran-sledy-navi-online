import { items, recipes } from './catalog.mjs';

const glyphs=[
  ['hearth','ᛟ','очага','Печать дома, тепла и принадлежности.'],
  ['boundary','ᛉ','границы','Закрепляет границу между Явью и Навью.'],
  ['silence','ᛏ','тишины','Подавляет шёпот, зов и чужую волю.'],
  ['path','ᚱ','пути','Открывает или запирает дорогу существа.'],
  ['memory','ᚾ','памяти','Связывает духа с его истинной историей.'],
  ['ward','ᛇ','защиты','Создаёт устойчивую защитную печать.'],
  ['water','ᛚ','воды','Управляет течением, глубиной и отражением.'],
  ['sun','ᛋ','солнца','Ослабляет существ жара, тени и полудня.'],
  ['dream','ᛗ','сна','Разрывает морок, кошмар и сонное оцепенение.'],
  ['truth','ᚨ','истины','Разоблачает ложные облики и обманные сделки.']
];
for(const [id,symbol,name,description] of glyphs){
  const itemId=`glyph_${id}`;
  if(!items.some(x=>x.id===itemId))items.push({id:itemId,name:`Глиф ${name}`,icon:symbol,type:'glyph',rarity:['hearth','boundary','silence'].includes(id)?'uncommon':'rare',tradable:true,description});
  const recipeId=`craft_glyph_${id}`;
  if(!recipes.some(x=>x.id===recipeId))recipes.push({id:recipeId,name:`Глиф ${name}`,profession:'runewriter',level:['hearth','boundary','silence'].includes(id)?1:2,inputs:{ash:2,thread:1,chalk:1},output:{itemId,qty:1},time:0});
}
