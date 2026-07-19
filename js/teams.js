// All 31 NHL teams + specials — 2002-03 Hitz rosters + 2019-20 stars (NHL Hitz 20-20 disc)
const TEAMS = [
  {
    id:'ana', abbr:'ANA', city:'Anaheim', name:'Mighty Ducks', full:'Anaheim Mighty Ducks',
    arena:'Arrowhead Pond', state:'California',
    colors:{ primary:'#010101', secondary:'#9C7D45', accent:'#00827F' },
    stars:['Getzlaf','Rakell','Silfverberg'],
    roster:[
      {ln:'Giguere',fn:'Jean-Sebastien',pos:'G',spd:78,pwr:70,chk:65,sht:60,rating:82},
      {ln:'Kariya',fn:'Paul',pos:'C',spd:96,pwr:72,chk:55,sht:92,rating:95},
      {ln:'Selanne',fn:'Teemu',pos:'RW',spd:90,pwr:80,chk:70,sht:94,rating:94},
      {ln:'Rucchin',fn:'Steve',pos:'C',spd:78,pwr:76,chk:75,sht:78,rating:80},
    ]
  },
  {
    id:'atl', abbr:'ATL', city:'Atlanta', name:'Thrashers', full:'Atlanta Thrashers',
    arena:'Philips Arena', state:'Georgia',
    colors:{ primary:'#003E7E', secondary:'#C8102E', accent:'#A2AAAD' },
    stars:['Kovalchuk','Heatley','Savard'],
    roster:[
      {ln:'Hedberg',fn:'Johan',pos:'G',spd:72,pwr:68,chk:60,sht:58,rating:74},
      {ln:'Heatley',fn:'Dany',pos:'LW',spd:85,pwr:82,chk:70,sht:90,rating:88},
      {ln:'Kovalchuk',fn:'Ilya',pos:'LW',spd:90,pwr:85,chk:65,sht:95,rating:92},
      {ln:'Belanger',fn:'Eric',pos:'C',spd:80,pwr:75,chk:72,sht:78,rating:79},
    ]
  },
  {
    id:'bos', abbr:'BOS', city:'Boston', name:'Bruins', full:'Boston Bruins',
    arena:'Fleet Center', state:'Massachusetts',
    colors:{ primary:'#FFB81C', secondary:'#010101', accent:'#FFFFFF' },
    stars:['Marchand','Bergeron','Pastrnak'],
    roster:[
      {ln:'Raycroft',fn:'Andrew',pos:'G',spd:74,pwr:70,chk:62,sht:60,rating:76},
      {ln:'Thornton',fn:'Joe',pos:'C',spd:85,pwr:90,chk:82,sht:86,rating:92},
      {ln:'Allison',fn:'Jason',pos:'C',spd:80,pwr:84,chk:78,sht:84,rating:87},
      {ln:'Amonte',fn:'Tony',pos:'RW',spd:87,pwr:78,chk:68,sht:88,rating:87},
    ]
  },
  {
    id:'buf', abbr:'BUF', city:'Buffalo', name:'Sabres', full:'Buffalo Sabres',
    arena:'Marine Midland Arena', state:'New York',
    colors:{ primary:'#002654', secondary:'#FCB514', accent:'#FFFFFF' },
    stars:['Eichel','Reinhart','Skinner'],
    roster:[
      {ln:'Biron',fn:'Martin',pos:'G',spd:74,pwr:68,chk:62,sht:60,rating:78},
      {ln:'Briere',fn:'Daniel',pos:'C',spd:88,pwr:74,chk:65,sht:86,rating:86},
      {ln:'Zhitnik',fn:'Alexei',pos:'D',spd:80,pwr:84,chk:86,sht:78,rating:83},
      {ln:'Peca',fn:'Michael',pos:'C',spd:84,pwr:76,chk:88,sht:78,rating:84},
    ]
  },
  {
    id:'car', abbr:'CAR', city:'Carolina', name:'Hurricanes', full:'Carolina Hurricanes',
    arena:'Raleigh Entertainment and Sports Arena', state:'North Carolina',
    colors:{ primary:'#CC0000', secondary:'#010101', accent:'#A2AAAD' },
    stars:['Aho','Svechnikov','Teravainen'],
    roster:[
      {ln:'Irbe',fn:'Arturs',pos:'G',spd:70,pwr:68,chk:60,sht:60,rating:76},
      {ln:'Brind\'Amour',fn:'Rod',pos:'C',spd:82,pwr:88,chk:85,sht:82,rating:88},
      {ln:'Francis',fn:'Ron',pos:'C',spd:76,pwr:82,chk:72,sht:80,rating:85},
      {ln:'Recchi',fn:'Mark',pos:'RW',spd:82,pwr:78,chk:72,sht:86,rating:86},
    ]
  },
  {
    id:'cgy', abbr:'CGY', city:'Calgary', name:'Flames', full:'Calgary Flames',
    arena:'Pengrowth Saddledome', state:'Alberta',
    colors:{ primary:'#C8102E', secondary:'#F1BE48', accent:'#010101' },
    stars:['M.Tkachuk','Gaudreau','Lindholm'],
    roster:[
      {ln:'McLennan',fn:'Jamie',pos:'G',spd:72,pwr:68,chk:60,sht:58,rating:74},
      {ln:'Iginla',fn:'Jarome',pos:'RW',spd:88,pwr:92,chk:85,sht:94,rating:95},
      {ln:'Conroy',fn:'Craig',pos:'C',spd:82,pwr:80,chk:80,sht:80,rating:82},
      {ln:'Donovan',fn:'Shean',pos:'LW',spd:86,pwr:76,chk:74,sht:78,rating:80},
    ]
  },
  {
    id:'chi', abbr:'CHI', city:'Chicago', name:'Blackhawks', full:'Chicago Blackhawks',
    arena:'United Center', state:'Illinois',
    colors:{ primary:'#CF0A2C', secondary:'#010101', accent:'#FF671B' },
    stars:['Kane','Toews','DeBrincat'],
    roster:[
      {ln:'Khabibulin',fn:'Nikolai',pos:'G',spd:74,pwr:70,chk:64,sht:62,rating:80},
      {ln:'Amonte',fn:'Tony',pos:'RW',spd:87,pwr:78,chk:68,sht:88,rating:87},
      {ln:'Sullivan',fn:'Steve',pos:'C',spd:90,pwr:72,chk:60,sht:82,rating:83},
      {ln:'Daze',fn:'Eric',pos:'LW',spd:82,pwr:86,chk:74,sht:90,rating:88},
    ]
  },
  {
    id:'clm', abbr:'CLM', city:'Columbus', name:'Blue Jackets', full:'Columbus Blue Jackets',
    arena:'Nationwide Arena', state:'Ohio',
    colors:{ primary:'#002654', secondary:'#CE1126', accent:'#A2AAAD' },
    stars:['Dubois','Atkinson','Bjorkstrand'],
    roster:[
      {ln:'Tugnutt',fn:'Ron',pos:'G',spd:70,pwr:66,chk:60,sht:58,rating:73},
      {ln:'Bure',fn:'Valeri',pos:'RW',spd:94,pwr:78,chk:60,sht:92,rating:90},
      {ln:'Marchment',fn:'Bryan',pos:'D',spd:76,pwr:86,chk:92,sht:70,rating:80},
      {ln:'Leschyshyn',fn:'Curtis',pos:'D',spd:74,pwr:80,chk:82,sht:68,rating:76},
    ]
  },
  {
    id:'col', abbr:'COL', city:'Colorado', name:'Avalanche', full:'Colorado Avalanche',
    arena:'Pepsi Center', state:'Colorado',
    colors:{ primary:'#6F263D', secondary:'#236192', accent:'#A2AAAD' },
    stars:['MacKinnon','Landeskog','Rantanen'],
    roster:[
      {ln:'Roy',fn:'Patrick',pos:'G',spd:76,pwr:74,chk:68,sht:68,rating:95},
      {ln:'Sakic',fn:'Joe',pos:'C',spd:88,pwr:82,chk:72,sht:95,rating:96},
      {ln:'Forsberg',fn:'Peter',pos:'C',spd:90,pwr:90,chk:80,sht:94,rating:99},
      {ln:'Deadmarsh',fn:'Adam',pos:'RW',spd:84,pwr:82,chk:80,sht:86,rating:86},
    ]
  },
  {
    id:'dal', abbr:'DAL', city:'Dallas', name:'Stars', full:'Dallas Stars',
    arena:'American Airlines Center', state:'Texas',
    colors:{ primary:'#006847', secondary:'#8F8F8C', accent:'#010101' },
    stars:['Seguin','Benn','Radulov'],
    roster:[
      {ln:'Belfour',fn:'Ed',pos:'G',spd:76,pwr:72,chk:66,sht:66,rating:88},
      {ln:'Modano',fn:'Mike',pos:'C',spd:92,pwr:84,chk:74,sht:90,rating:93},
      {ln:'Nieuwendyk',fn:'Joe',pos:'C',spd:80,pwr:82,chk:76,sht:88,rating:87},
      {ln:'Hatcher',fn:'Derian',pos:'D',spd:76,pwr:92,chk:96,sht:72,rating:86},
    ]
  },
  {
    id:'det', abbr:'DET', city:'Detroit', name:'Red Wings', full:'Detroit Red Wings',
    arena:'Joe Louis Arena', state:'Michigan',
    colors:{ primary:'#CE1126', secondary:'#FFFFFF', accent:'#010101' },
    stars:['Larkin','Mantha','Athanasiou'],
    roster:[
      {ln:'Hasek',fn:'Dominik',pos:'G',spd:76,pwr:72,chk:66,sht:68,rating:96},
      {ln:'Yzerman',fn:'Steve',pos:'C',spd:84,pwr:82,chk:78,sht:90,rating:93},
      {ln:'Fedorov',fn:'Sergei',pos:'C',spd:94,pwr:88,chk:82,sht:90,rating:96},
      {ln:'Hull',fn:'Brett',pos:'RW',spd:80,pwr:82,chk:68,sht:98,rating:94},
    ]
  },
  {
    id:'edm', abbr:'EDM', city:'Edmonton', name:'Oilers', full:'Edmonton Oilers',
    arena:'SkyReach Center', state:'Alberta',
    colors:{ primary:'#041E42', secondary:'#FF4C00', accent:'#FFFFFF' },
    stars:['McDavid','Draisaitl','Nugent-Hopkins'],
    roster:[
      {ln:'Joseph',fn:'Curtis',pos:'G',spd:74,pwr:70,chk:64,sht:62,rating:84},
      {ln:'Weight',fn:'Doug',pos:'C',spd:84,pwr:80,chk:74,sht:84,rating:87},
      {ln:'Smyth',fn:'Ryan',pos:'LW',spd:84,pwr:80,chk:76,sht:86,rating:86},
      {ln:'Guerin',fn:'Bill',pos:'RW',spd:84,pwr:84,chk:80,sht:88,rating:87},
    ]
  },
  {
    id:'fla', abbr:'FLA', city:'Florida', name:'Panthers', full:'Florida Panthers',
    arena:'National Car Rental Center', state:'Florida',
    colors:{ primary:'#041E42', secondary:'#C8102E', accent:'#B9975B' },
    stars:['Barkov','Huberdeau','Hoffman'],
    roster:[
      {ln:'Luongo',fn:'Roberto',pos:'G',spd:74,pwr:70,chk:64,sht:64,rating:85},
      {ln:'Bure',fn:'Pavel',pos:'RW',spd:98,pwr:82,chk:65,sht:97,rating:97},
      {ln:'Dvorak',fn:'Radek',pos:'C',spd:82,pwr:78,chk:72,sht:80,rating:82},
      {ln:'Jokinen',fn:'Olli',pos:'C',spd:82,pwr:80,chk:76,sht:84,rating:83},
    ]
  },
  {
    id:'la', abbr:'LA', city:'Los Angeles', name:'Kings', full:'Los Angeles Kings',
    arena:'Staples Center', state:'California',
    colors:{ primary:'#010101', secondary:'#A2AAAD', accent:'#FFFFFF' },
    stars:['Kopitar','Doughty','Toffoli'],
    roster:[
      {ln:'Cloutier',fn:'Dan',pos:'G',spd:72,pwr:68,chk:62,sht:60,rating:76},
      {ln:'Blake',fn:'Rob',pos:'D',spd:84,pwr:94,chk:94,sht:88,rating:94},
      {ln:'Palffy',fn:'Ziggy',pos:'RW',spd:86,pwr:78,chk:68,sht:92,rating:89},
      {ln:'Deadmarsh',fn:'Adam',pos:'RW',spd:84,pwr:82,chk:80,sht:86,rating:86},
    ]
  },
  {
    id:'min', abbr:'MIN', city:'Minnesota', name:'Wild', full:'Minnesota Wild',
    arena:'Excel Energy Center', state:'Minnesota',
    colors:{ primary:'#154734', secondary:'#A6192E', accent:'#DDCBA4' },
    stars:['Parise','Staal','Fiala'],
    roster:[
      {ln:'Fernandez',fn:'Manny',pos:'G',spd:72,pwr:68,chk:62,sht:60,rating:78},
      {ln:'Gaborik',fn:'Marian',pos:'LW',spd:94,pwr:80,chk:64,sht:92,rating:91},
      {ln:'Brunette',fn:'Andrew',pos:'LW',spd:78,pwr:78,chk:70,sht:82,rating:80},
      {ln:'Walz',fn:'Wes',pos:'C',spd:80,pwr:74,chk:72,sht:78,rating:79},
    ]
  },
  {
    id:'mtl', abbr:'MTL', city:'Montreal', name:'Canadiens', full:'Montreal Canadiens',
    arena:'Bell Centre', state:'Quebec',
    colors:{ primary:'#AF1E2D', secondary:'#192168', accent:'#FFFFFF' },
    stars:['Gallagher','Weber','Tatar'],
    roster:[
      {ln:'Theodore',fn:'Jose',pos:'G',spd:74,pwr:70,chk:64,sht:64,rating:88},
      {ln:'Koivu',fn:'Saku',pos:'C',spd:86,pwr:74,chk:70,sht:84,rating:87},
      {ln:'Zednik',fn:'Richard',pos:'LW',spd:90,pwr:74,chk:68,sht:84,rating:83},
      {ln:'Recchi',fn:'Mark',pos:'RW',spd:82,pwr:78,chk:72,sht:86,rating:86},
    ]
  },
  {
    id:'nj', abbr:'NJ', city:'New Jersey', name:'Devils', full:'New Jersey Devils',
    arena:'Continental Airlines Arena', state:'New Jersey',
    colors:{ primary:'#CE1126', secondary:'#010101', accent:'#FFFFFF' },
    stars:['Hall','Hischier','Palmieri'],
    roster:[
      {ln:'Brodeur',fn:'Martin',pos:'G',spd:76,pwr:72,chk:66,sht:66,rating:95},
      {ln:'Arnott',fn:'Jason',pos:'C',spd:82,pwr:86,chk:80,sht:86,rating:87},
      {ln:'Elias',fn:'Patrik',pos:'LW',spd:86,pwr:78,chk:70,sht:88,rating:89},
      {ln:'Brylin',fn:'Sergei',pos:'LW',spd:82,pwr:74,chk:72,sht:78,rating:80},
    ]
  },
  {
    id:'nsh', abbr:'NSH', city:'Nashville', name:'Predators', full:'Nashville Predators',
    arena:'Gaylord Entertainment Center', state:'Tennessee',
    colors:{ primary:'#041E42', secondary:'#FFB81C', accent:'#FFFFFF' },
    stars:['Forsberg','Josi','Johansen'],
    roster:[
      {ln:'Vokoun',fn:'Tomas',pos:'G',spd:72,pwr:68,chk:62,sht:62,rating:80},
      {ln:'Kariya',fn:'Steve',pos:'LW',spd:86,pwr:70,chk:62,sht:82,rating:80},
      {ln:'Legwand',fn:'David',pos:'C',spd:84,pwr:78,chk:72,sht:80,rating:82},
      {ln:'Sullivan',fn:'Steve',pos:'C',spd:90,pwr:72,chk:60,sht:82,rating:83},
    ]
  },
  {
    id:'nyi', abbr:'NYI', city:'New York', name:'Islanders', full:'New York Islanders',
    arena:'Nassau Veterans Memorial Coliseum', state:'New York',
    colors:{ primary:'#003087', secondary:'#FC4C02', accent:'#FFFFFF' },
    stars:['Barzal','Lee','Nelson'],
    roster:[
      {ln:'DiPietro',fn:'Rick',pos:'G',spd:72,pwr:68,chk:62,sht:60,rating:74},
      {ln:'Yashin',fn:'Alexei',pos:'C',spd:82,pwr:82,chk:72,sht:88,rating:87},
      {ln:'Peca',fn:'Michael',pos:'C',spd:84,pwr:76,chk:88,sht:78,rating:84},
      {ln:'Simon',fn:'Chris',pos:'LW',spd:74,pwr:88,chk:90,sht:74,rating:78},
    ]
  },
  {
    id:'nyr', abbr:'NYR', city:'New York', name:'Rangers', full:'New York Rangers',
    arena:'Madison Square Garden', state:'New York',
    colors:{ primary:'#0038A8', secondary:'#CE1126', accent:'#FFFFFF' },
    stars:['Panarin','Zibanejad','Kreider'],
    roster:[
      {ln:'Dunham',fn:'Mike',pos:'G',spd:72,pwr:68,chk:62,sht:60,rating:76},
      {ln:'Holik',fn:'Bobby',pos:'C',spd:82,pwr:86,chk:84,sht:80,rating:83},
      {ln:'Lindros',fn:'Eric',pos:'C',spd:84,pwr:96,chk:90,sht:90,rating:90},
      {ln:'Messier',fn:'Mark',pos:'C',spd:74,pwr:84,chk:82,sht:82,rating:82},
    ]
  },
  {
    id:'ott', abbr:'OTT', city:'Ottawa', name:'Senators', full:'Ottawa Senators',
    arena:'Corel Centre', state:'Ontario',
    colors:{ primary:'#010101', secondary:'#C8102E', accent:'#C69214' },
    stars:['B.Tkachuk','Pageau','White'],
    roster:[
      {ln:'Lalime',fn:'Patrick',pos:'G',spd:74,pwr:70,chk:64,sht:62,rating:82},
      {ln:'Alfredsson',fn:'Daniel',pos:'RW',spd:88,pwr:80,chk:72,sht:90,rating:91},
      {ln:'Havlat',fn:'Martin',pos:'LW',spd:86,pwr:78,chk:68,sht:86,rating:85},
      {ln:'Spezza',fn:'Jason',pos:'C',spd:82,pwr:80,chk:68,sht:88,rating:84},
    ]
  },
  {
    id:'phi', abbr:'PHI', city:'Philadelphia', name:'Flyers', full:'Philadelphia Flyers',
    arena:'First Union Center', state:'Pennsylvania',
    colors:{ primary:'#F74902', secondary:'#010101', accent:'#FFFFFF' },
    stars:['Giroux','Couturier','Konecny'],
    roster:[
      {ln:'Burke',fn:'Sean',pos:'G',spd:72,pwr:70,chk:62,sht:62,rating:78},
      {ln:'LeClair',fn:'John',pos:'LW',spd:84,pwr:92,chk:86,sht:90,rating:92},
      {ln:'Lindros',fn:'Eric',pos:'C',spd:84,pwr:96,chk:90,sht:90,rating:90},
      {ln:'Recchi',fn:'Mark',pos:'RW',spd:82,pwr:78,chk:72,sht:86,rating:86},
    ]
  },
  {
    id:'phx', abbr:'PHX', city:'Phoenix', name:'Coyotes', full:'Phoenix Coyotes',
    arena:'America West Arena', state:'Arizona',
    colors:{ primary:'#8C2633', secondary:'#E2D6B5', accent:'#010101' },
    stars:['Keller','Ekman-Larsson','Dvorak'],
    roster:[
      {ln:'Khabibulin',fn:'Nikolai',pos:'G',spd:74,pwr:70,chk:64,sht:62,rating:80},
      {ln:'Tkachuk',fn:'Keith',pos:'LW',spd:82,pwr:92,chk:88,sht:88,rating:89},
      {ln:'Roenick',fn:'Jeremy',pos:'C',spd:84,pwr:84,chk:82,sht:86,rating:88},
      {ln:'Doan',fn:'Shane',pos:'RW',spd:82,pwr:80,chk:78,sht:80,rating:82},
    ]
  },
  {
    id:'pit', abbr:'PIT', city:'Pittsburgh', name:'Penguins', full:'Pittsburgh Penguins',
    arena:'Mellon Arena', state:'Pennsylvania',
    colors:{ primary:'#010101', secondary:'#CFC493', accent:'#FFFFFF' },
    stars:['Crosby','Malkin','Guentzel'],
    roster:[
      {ln:'Barrasso',fn:'Tom',pos:'G',spd:70,pwr:68,chk:60,sht:60,rating:76},
      {ln:'Lemieux',fn:'Mario',pos:'C',spd:86,pwr:90,chk:78,sht:97,rating:97},
      {ln:'Straka',fn:'Martin',pos:'C',spd:86,pwr:74,chk:66,sht:86,rating:84},
      {ln:'Kovalev',fn:'Alex',pos:'RW',spd:88,pwr:82,chk:72,sht:88,rating:88},
    ]
  },
  {
    id:'sj', abbr:'SJ', city:'San Jose', name:'Sharks', full:'San Jose Sharks',
    arena:'Compaq Center', state:'California',
    colors:{ primary:'#006D75', secondary:'#EA7200', accent:'#010101' },
    stars:['Couture','Hertl','Burns'],
    roster:[
      {ln:'Nabokov',fn:'Evgeni',pos:'G',spd:74,pwr:70,chk:64,sht:64,rating:84},
      {ln:'Owen',fn:'Nolan',pos:'C',spd:82,pwr:84,chk:80,sht:84,rating:85},
      {ln:'Thornton',fn:'Scott',pos:'LW',spd:80,pwr:82,chk:80,sht:78,rating:80},
      {ln:'Marleau',fn:'Patrick',pos:'LW',spd:88,pwr:80,chk:72,sht:84,rating:84},
    ]
  },
  {
    id:'stl', abbr:'STL', city:'St. Louis', name:'Blues', full:'St. Louis Blues',
    arena:'Savvis Center', state:'Missouri',
    colors:{ primary:'#002F87', secondary:'#FCB514', accent:'#003087' },
    stars:['O\'Reilly','Schwartz','Perron'],
    roster:[
      {ln:'Osgood',fn:'Chris',pos:'G',spd:72,pwr:68,chk:62,sht:62,rating:80},
      {ln:'Hull',fn:'Brett',pos:'RW',spd:80,pwr:82,chk:68,sht:98,rating:94},
      {ln:'MacInnis',fn:'Al',pos:'D',spd:76,pwr:84,chk:82,sht:92,rating:88},
      {ln:'Pronger',fn:'Chris',pos:'D',spd:82,pwr:94,chk:96,sht:82,rating:96},
    ]
  },
  {
    id:'tb', abbr:'TB', city:'Tampa Bay', name:'Lightning', full:'Tampa Bay Lightning',
    arena:'Ice Palace', state:'Florida',
    colors:{ primary:'#002868', secondary:'#FFFFFF', accent:'#000000' },
    stars:['Kucherov','Stamkos','Point'],
    roster:[
      {ln:'Khabibulin',fn:'Nikolai',pos:'G',spd:74,pwr:70,chk:64,sht:62,rating:80},
      {ln:'St. Louis',fn:'Martin',pos:'RW',spd:90,pwr:76,chk:68,sht:88,rating:89},
      {ln:'Lecavalier',fn:'Vincent',pos:'C',spd:86,pwr:82,chk:72,sht:88,rating:88},
      {ln:'Richards',fn:'Brad',pos:'C',spd:84,pwr:78,chk:70,sht:84,rating:84},
    ]
  },
  {
    id:'tor', abbr:'TOR', city:'Toronto', name:'Maple Leafs', full:'Toronto Maple Leafs',
    arena:'Air Canada Centre', state:'Ontario',
    colors:{ primary:'#003E7E', secondary:'#FFFFFF', accent:'#010101' },
    stars:['Matthews','Marner','Tavares'],
    roster:[
      {ln:'Belfour',fn:'Ed',pos:'G',spd:76,pwr:72,chk:66,sht:66,rating:88},
      {ln:'Roberts',fn:'Gary',pos:'LW',spd:80,pwr:88,chk:86,sht:84,rating:84},
      {ln:'Sundin',fn:'Mats',pos:'C',spd:84,pwr:88,chk:78,sht:92,rating:94},
      {ln:'Tucker',fn:'Darcy',pos:'RW',spd:82,pwr:80,chk:82,sht:80,rating:82},
    ]
  },
  {
    id:'van', abbr:'VAN', city:'Vancouver', name:'Canucks', full:'Vancouver Canucks',
    arena:'General Motors Place', state:'British Columbia',
    colors:{ primary:'#00205B', secondary:'#00843D', accent:'#041C2C' },
    stars:['Pettersson','Boeser','Hughes'],
    roster:[
      {ln:'Cloutier',fn:'Dan',pos:'G',spd:72,pwr:68,chk:62,sht:60,rating:76},
      {ln:'Naslund',fn:'Markus',pos:'LW',spd:88,pwr:80,chk:70,sht:92,rating:93},
      {ln:'Morrison',fn:'Brendan',pos:'C',spd:84,pwr:78,chk:74,sht:82,rating:83},
      {ln:'Bertuzzi',fn:'Todd',pos:'LW',spd:82,pwr:90,chk:86,sht:86,rating:89},
    ]
  },
  {
    id:'wsh', abbr:'WSH', city:'Washington', name:'Capitals', full:'Washington Capitals',
    arena:'MCI Center', state:'DC',
    colors:{ primary:'#041E42', secondary:'#C8102E', accent:'#FFFFFF' },
    stars:['Ovechkin','Backstrom','Wilson'],
    roster:[
      {ln:'Kolzig',fn:'Olaf',pos:'G',spd:74,pwr:72,chk:64,sht:64,rating:86},
      {ln:'Bondra',fn:'Peter',pos:'RW',spd:92,pwr:80,chk:68,sht:94,rating:93},
      {ln:'Jagr',fn:'Jaromir',pos:'RW',spd:88,pwr:90,chk:78,sht:94,rating:97},
      {ln:'Gonchar',fn:'Sergei',pos:'D',spd:82,pwr:82,chk:80,sht:84,rating:85},
    ]
  },
  // Vegas Golden Knights — added in NHL Hitz 20-20 mod
  {
    id:'vgk', abbr:'VGK', city:'Las Vegas', name:'Golden Knights', full:'Vegas Golden Knights',
    arena:'T-Mobile Arena', state:'Nevada',
    colors:{ primary:'#B4975A', secondary:'#333F42', accent:'#000000' },
    stars:['Stone','Pacioretty','Marchessault'],
    roster:[
      {ln:'Fleury',fn:'Marc-Andre',pos:'G',spd:78,pwr:72,chk:66,sht:68,rating:93},
      {ln:'Stone',fn:'Mark',pos:'RW',spd:84,pwr:84,chk:78,sht:90,rating:92},
      {ln:'Pacioretty',fn:'Max',pos:'LW',spd:86,pwr:84,chk:74,sht:90,rating:88},
      {ln:'Marchessault',fn:'Jonathan',pos:'C',spd:84,pwr:76,chk:68,sht:86,rating:86},
    ]
  },
];

// Special / fantasy teams
const SPECIAL_TEAMS = [
  {
    id:'canada', abbr:'CAN', city:'Team', name:'Canada', full:'Team Canada',
    colors:{ primary:'#FF0000', secondary:'#FFFFFF', accent:'#000000' },
    stars:['McDavid','Crosby','MacKinnon'],
    roster:[
      {ln:'Joseph',fn:'Curtis',pos:'G',spd:74,pwr:70,chk:64,sht:62,rating:84},
      {ln:'Sakic',fn:'Joe',pos:'C',spd:88,pwr:82,chk:72,sht:95,rating:96},
      {ln:'Iginla',fn:'Jarome',pos:'RW',spd:88,pwr:92,chk:85,sht:94,rating:95},
      {ln:'Blake',fn:'Rob',pos:'D',spd:84,pwr:94,chk:94,sht:88,rating:94},
    ]
  },
  {
    id:'russia', abbr:'RUS', city:'Team', name:'Russia', full:'Team Russia',
    colors:{ primary:'#CC0000', secondary:'#003082', accent:'#FFFFFF' },
    stars:['Ovechkin','Malkin','Kucherov'],
    roster:[
      {ln:'Hasek',fn:'Dominik',pos:'G',spd:76,pwr:72,chk:66,sht:68,rating:96},
      {ln:'Fedorov',fn:'Sergei',pos:'C',spd:94,pwr:88,chk:82,sht:90,rating:96},
      {ln:'Bure',fn:'Pavel',pos:'RW',spd:98,pwr:82,chk:65,sht:97,rating:97},
      {ln:'Gonchar',fn:'Sergei',pos:'D',spd:82,pwr:82,chk:80,sht:84,rating:85},
    ]
  },
  {
    id:'usa', abbr:'USA', city:'Team', name:'USA', full:'Team USA',
    colors:{ primary:'#002868', secondary:'#BF0A30', accent:'#FFFFFF' },
    stars:['Kane','Matthews','Eichel'],
    roster:[
      {ln:'Richter',fn:'Mike',pos:'G',spd:74,pwr:70,chk:64,sht:64,rating:82},
      {ln:'Hull',fn:'Brett',pos:'RW',spd:80,pwr:82,chk:68,sht:98,rating:94},
      {ln:'Modano',fn:'Mike',pos:'C',spd:92,pwr:84,chk:74,sht:90,rating:93},
      {ln:'Chelios',fn:'Chris',pos:'D',spd:76,pwr:88,chk:92,sht:74,rating:88},
    ]
  },
];

export { TEAMS, SPECIAL_TEAMS };
