const fs = require('fs');
const path = require('path');

const mapFile = path.join(__dirname, '../data/moderator_map.json');
const map = JSON.parse(fs.readFileSync(mapFile, 'utf8'));

const newMods = [
    '@5080',
    '@acrostome',
    '@aloeanight',
    '@blissful_muse.',
    '@.boopp',
    '@dribb1e',
    '@fireworksgunpowder',
    '@fruitysuma',
    '@ghostyretribution',
    '@itsnotm',
    '@jadeythegreat_47079',
    '@kimchiiwo',
    '@kizonvh',
    '@leastfavmango',
    '@liyalavender',
    '@lullabyraven',
    '@magical._mirai',
    '@.pretty17.',
    '@quackcake91651',
    '@sacred_lover21',
    '@soulsoulsoulsoulsoul',
    '@su_il',
    '@_synz_.',
    '@tatorterm',
    '@tomuchburb23',
    '@vashplush',
    '@viregretnothing',
    '@xnaeza',
    '@xuan_r3',
    '@xytostome',
    '@yuii_ai',
    '@zayyyy3'
];

let added = 0;
newMods.forEach(mod => {
    if (!map[mod]) {
        map[mod] = 'REPLACE_WITH_DISCORD_ID';
        added++;
    }
});

fs.writeFileSync(mapFile, JSON.stringify(map, null, 2));
console.log(`✓ Added ${added} new moderators to the map`);
console.log(`Total moderators in map: ${Object.keys(map).length}`);
