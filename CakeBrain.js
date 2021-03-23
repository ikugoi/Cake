const config = require('./config.json'); //Retrieve cake's personnal informations
const { exec } = require('child_process'); //Start PerformanceCalculator
const getUrls = require('get-urls'); //Retrieve beatmaps URLs
var validUrl = require('valid-url'); //Verify if URL is valid
const osu = require('node-osu'); //Retrieve players informations
const osuApi = new osu.Api(config.osuApiKey, { notFoundAsError: true, completeScores: true })
const Banchojs = require("bancho.js"); //BanchoBot IRC
const client = new Banchojs.BanchoClient({ username: config.osuUsername, password: config.banchoJsPassword });
var rp = require('request-promise'); //Request data from URL
const fs = require('fs'); //.osu file download
const download = (url, path, callback) => { rp(url, (err, res, body) => { rp(url).pipe(fs.createWriteStream(path)).on('close', callback); }); }
var colors = require('colors'); //Console Colors
colors.setTheme({ oopsie: ['black', 'bgRed'], debug: 'brightGreen', pm: ['brightYellow', 'bold'], pmself: ['yellow', 'bold'] });

function CalculatePerformancePoint(resolve, filePath, accuracy, mods) {
    var cmdMods = '';
    mods.forEach(element => { cmdMods += ` -m ${element}`; });
    exec(`dotnet ${config.locationPerformanceCalculator} simulate osu -a ${accuracy} ${filePath} -j${cmdMods.toLowerCase()}`, (error, stdout, stderr) => {
        if (error) { console.log(colors.oopsie(error.message)); return 0; }
        if (stderr) { console.log(colors.oopsie(stderr)); return 0; }
        var jsonOut = JSON.parse(stdout);
        resolve(Math.ceil(jsonOut.pp));
        return;
    });
};

client.connect().then(() => {
    console.log(colors.debug('Cake connected to BanchoBot'));
    client.on("PM", (message) => {
        console.log((message.user.ircUsername == config.osuUsername) ? colors.pmself(`${message.user.ircUsername}: ${message.message}`) : colors.pm(`${message.user.ircUsername}: ${message.message}`));

        //Ping
        if(message.message.indexOf(".ping") == 0)
            message.user.sendMessage("pong.");

        //Detect received beatmap and calcul PP
        if(message.message.includes("osu.ppy.sh")) {
            getUrls(message.message, {requireSchemeOrWww: false}).forEach(element => {
                if(!validUrl.isUri(element)) return;
                element = new URL(element);
                if(element.hostname != "osu.ppy.sh") return;
                var beatmapID = element.pathname.split("/");
                beatmapID = beatmapID[beatmapID.length - 1];
                if(isNaN(beatmapID)) return;
                var modArgs = message.message.split("+").join("-").split("-"), mods = [];
                modArgs.forEach(element => { 
                    if(element.includes("HD") || element.includes("Hidden")) mods.push("HD");
                    if(element.includes("HR") || element.includes("HardRock")) mods.push("HR");
                    if(element.includes("FL") || element.includes("Flashlight")) mods.push("FL");
                    if(element.includes("NF") || element.includes("NoFail")) mods.push("NF");
                    if(element.includes("EZ") || element.includes("Easy")) mods.push("EZ");
                    if(element.includes("NC") || element.includes("NightCore")) mods.push("NC");
                    if(element.includes("HT") || element.includes("HalfTime")) mods.push("HT");
                    if(element.includes("DT") || element.includes("DoubleTime")) mods.push("DT");
                });
                var filePath = (new Date().getTime() + ".osu");
                download(`https://osu.ppy.sh/osu/${beatmapID}`, filePath, () => {
                    var acc100 = new Promise((resolve, reject) => { CalculatePerformancePoint(resolve, filePath, 100, mods); });
                    var acc99 = new Promise((resolve, reject) => { CalculatePerformancePoint(resolve, filePath, 99, mods); });
                    var acc98 = new Promise((resolve, reject) => { CalculatePerformancePoint(resolve, filePath, 98, mods); });
                    var acc97 = new Promise((resolve, reject) => { CalculatePerformancePoint(resolve, filePath, 97, mods); });
                    var acc95 = new Promise((resolve, reject) => { CalculatePerformancePoint(resolve, filePath, 95, mods); });
                    Promise.all([acc100, acc99, acc98, acc97, acc95]).then((values) => {
                        message.user.sendMessage(`95% ${values[4]}pp | 97% ${values[3]}pp | 98% ${values[2]}pp | 99% ${values[1]}pp | 100% ${values[0]}pp 🟣 +${mods.join("")}`);
                        if(fs.existsSync(filePath)) fs.unlinkSync(filePath);
                    });
                });
            });
        }
    });
}).catch((e) => { console.log(colors.oopsie(e)); });