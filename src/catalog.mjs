export const creatures = [
  { id:'domovoy', name:'Домовой', title:'Хранитель порога', biome:'city', rarity:'common', temperament:'peaceful', encounter:'signal', image:'/assets/creatures/domovoy.png', lore:'Помнит голоса всех, кто когда-либо жил в доме.', drops:{ash:2, thread:1}, preferred:'calm' },
  { id:'kikimora', name:'Кикимора', title:'Шёпот пустых комнат', biome:'city', rarity:'uncommon', temperament:'tricky', encounter:'ritual', image:'/assets/creatures/kikimora.png', lore:'Запутывает дороги и прячет забытые вещи.', drops:{thread:2, mirror:1}, preferred:'study' },
  { id:'ovinnik', name:'Овинник', title:'Угольный страж', biome:'city', rarity:'rare', temperament:'hostile', encounter:'chase', image:'/assets/creatures/ovinnik.png', lore:'Сторожит места, где огонь однажды вышел из-под контроля.', drops:{ash:4, bone:1}, preferred:'banish' },
  { id:'leshy', name:'Леший', title:'Хозяин троп', biome:'park', rarity:'rare', temperament:'proud', encounter:'signal', image:'/assets/creatures/leshy.png', lore:'Меняет направление тропы, если путник не уважает лес.', drops:{bark:3, thread:1}, preferred:'calm' },
  { id:'polevik', name:'Полевик', title:'Ветер сухой травы', biome:'park', rarity:'uncommon', temperament:'restless', encounter:'chase', image:'/assets/creatures/polevik.png', lore:'Бежит впереди ветра и оставляет на земле круги.', drops:{bark:1, feather:2}, preferred:'study' },
  { id:'poludnitsa', name:'Полудница', title:'Белый жар', biome:'park', rarity:'epic', temperament:'hostile', encounter:'ritual', image:'/assets/creatures/poludnitsa.png', lore:'Появляется там, где солнце стирает тени.', drops:{sunstone:1, ash:5}, preferred:'banish' },
  { id:'rusalka', name:'Русалка', title:'Память воды', biome:'water', rarity:'rare', temperament:'melancholic', encounter:'signal', image:'/assets/creatures/rusalka.png', lore:'Собирает воспоминания, которые люди оставляют у воды.', drops:{water:3, thread:2}, preferred:'study' },
  { id:'vodyanoy', name:'Водяной', title:'Смотритель глубины', biome:'water', rarity:'epic', temperament:'proud', encounter:'ritual', image:'/assets/creatures/vodyanoy.png', lore:'Не любит долгов и всегда помнит обещания.', drops:{water:5, mirror:2}, preferred:'calm' },
  { id:'bannik', name:'Банник', title:'Дух горячего камня', biome:'city', rarity:'uncommon', temperament:'irritable', encounter:'chase', image:'/assets/creatures/bannik.png', lore:'Предупреждает об опасности стуком по стене.', drops:{ash:2, salt:2}, preferred:'calm' },
  { id:'nochnitsa', name:'Ночница', title:'Гостья бессонницы', biome:'night', rarity:'rare', temperament:'hostile', encounter:'chase', image:'/assets/creatures/nochnitsa.gif', lore:'Приходит к тем, кто слишком долго смотрит в темноту.', drops:{feather:3, mirror:1}, preferred:'banish' },
  { id:'likho', name:'Лихо', title:'Одноглазая неудача', biome:'night', rarity:'legendary', temperament:'hostile', encounter:'ritual', image:'/assets/creatures/likho.png', lore:'Не нападает сразу — сначала предлагает выгодную сделку.', drops:{bone:3, mirror:3, voidshard:1}, preferred:'study' },
  { id:'mara', name:'Мара', title:'Тень чужого сна', biome:'night', rarity:'epic', temperament:'mysterious', encounter:'signal', image:'/assets/creatures/mara.png', lore:'Оставляет на стекле слова, которые исчезают на рассвете.', drops:{feather:2, voidshard:1}, preferred:'study' }
];

export const items = [
  { id:'ash', name:'Пепел Нави', icon:'✦', type:'material', rarity:'common', tradable:true, description:'Остывший след аномалии.' },
  { id:'thread', name:'Серебряная нить', icon:'⌁', type:'material', rarity:'common', tradable:true, description:'Соединяет предмет с его прежним владельцем.' },
  { id:'mirror', name:'Осколок зеркала', icon:'◇', type:'material', rarity:'uncommon', tradable:true, description:'Отражает то, чего нет в Яви.' },
  { id:'feather', name:'Перо ночницы', icon:'⌇', type:'material', rarity:'uncommon', tradable:true, description:'Не отбрасывает тени.' },
  { id:'bark', name:'Кора старого лешего', icon:'♧', type:'material', rarity:'common', tradable:true, description:'Тёплая даже зимой.' },
  { id:'water', name:'Вода из разлома', icon:'◌', type:'material', rarity:'uncommon', tradable:true, description:'Течёт вверх, если рядом дух.' },
  { id:'bone', name:'Руническая кость', icon:'⋈', type:'material', rarity:'rare', tradable:true, description:'На ней сами проявляются знаки.' },
  { id:'salt', name:'Защитная соль', icon:'∴', type:'material', rarity:'common', tradable:true, description:'Основа защитных кругов.' },
  { id:'sunstone', name:'Камень Полудницы', icon:'☼', type:'material', rarity:'epic', tradable:true, description:'Хранит сухой полуденный жар.' },
  { id:'voidshard', name:'Осколок пустоты', icon:'⬖', type:'material', rarity:'legendary', tradable:true, description:'Фрагмент границы между мирами.' },
  { id:'chalk', name:'Ритуальный мел', icon:'╱', type:'consumable', rarity:'common', tradable:true, description:'Увеличивает точность ритуала.', effects:{ritualBonus:0.08} },
  { id:'incense', name:'Благовоние троп', icon:'≈', type:'consumable', rarity:'uncommon', tradable:true, description:'На 20 минут увеличивает радиус сканера.', effects:{scanRadius:150} },
  { id:'healing_salt', name:'Соль возвращения', icon:'✣', type:'consumable', rarity:'rare', tradable:true, description:'Снимает одно проклятие.' },
  { id:'raven_eye', name:'Глаз Ворона', icon:'◉', type:'amulet', rarity:'rare', tradable:true, description:'Редкие следы видны дальше, но опасные встречи сложнее.', effects:{rareVision:250, danger:0.08} },
  { id:'house_knot', name:'Узел Домового', icon:'⌘', type:'amulet', rarity:'uncommon', tradable:true, description:'Улучшает мирные договоры в городе.', effects:{calmBonus:0.12} },
  { id:'silver_thread_amulet', name:'Серебряная нить', icon:'∞', type:'amulet', rarity:'rare', tradable:true, description:'Защищает от тумана Нави.', effects:{signalBonus:0.12} },
  { id:'noon_stone', name:'Камень Полудницы', icon:'☀', type:'amulet', rarity:'epic', tradable:true, description:'Сильнее днём и слабее ночью.', effects:{dayBonus:0.18, nightPenalty:0.08} },
  { id:'mirror_compass', name:'Зеркальный компас', icon:'✥', type:'amulet', rarity:'epic', tradable:true, description:'Показывает направление к ближайшему неисследованному следу.', effects:{discovery:0.16} }
];

export const recipes = [
  { id:'craft_chalk', name:'Ритуальный мел', profession:'runewriter', level:1, inputs:{salt:2, ash:1}, output:{itemId:'chalk', qty:2}, time:0 },
  { id:'craft_incense', name:'Благовоние троп', profession:'herbalist', level:1, inputs:{bark:2, feather:1}, output:{itemId:'incense', qty:1}, time:0 },
  { id:'craft_house_knot', name:'Узел Домового', profession:'warder', level:1, inputs:{thread:3, bark:2, ash:2}, output:{itemId:'house_knot', qty:1}, time:0 },
  { id:'craft_silver_amulet', name:'Серебряная нить', profession:'warder', level:2, inputs:{thread:5, mirror:2, water:1}, output:{itemId:'silver_thread_amulet', qty:1}, time:0 },
  { id:'craft_raven_eye', name:'Глаз Ворона', profession:'artifactsmith', level:2, inputs:{feather:4, bone:2, mirror:2}, output:{itemId:'raven_eye', qty:1}, time:0 },
  { id:'craft_noon_stone', name:'Камень Полудницы', profession:'artifactsmith', level:3, inputs:{sunstone:1, ash:8, bone:2}, output:{itemId:'noon_stone', qty:1}, time:0 },
  { id:'craft_mirror_compass', name:'Зеркальный компас', profession:'runewriter', level:3, inputs:{mirror:5, thread:5, voidshard:1}, output:{itemId:'mirror_compass', qty:1}, time:0 }
];

export const professions = [
  {id:'runewriter', name:'Рунописец', icon:'⌬'},
  {id:'herbalist', name:'Травник', icon:'❧'},
  {id:'warder', name:'Оберегатель', icon:'⛉'},
  {id:'artifactsmith', name:'Артефактор', icon:'⚒'}
];

export const rarities = {
  common:{name:'Обычный', weight:1, reward:1},
  uncommon:{name:'Необычный', weight:1.35, reward:1.3},
  rare:{name:'Редкий', weight:1.8, reward:1.8},
  epic:{name:'Эпический', weight:2.6, reward:2.8},
  legendary:{name:'Легендарный', weight:4, reward:4.5}
};

export const worldObjectTypes = {
  trace:{name:'След', icon:'⌁'},
  creature:{name:'Существо', icon:'◉'},
  artifact:{name:'Артефакт', icon:'◇'},
  rift:{name:'Разлом', icon:'⬡'},
  resource:{name:'Место силы', icon:'✦'}
};

export const getCreature = id => creatures.find(x=>x.id===id);
export const getItem = id => items.find(x=>x.id===id);
export const getRecipe = id => recipes.find(x=>x.id===id);
