// import dependencies
const dotenv = require("dotenv");
dotenv.config(); // setup dotenv

const Moralis = require("moralis/node");
const request = require("request");
const fs = require("fs");
const { default: axios } = require("axios");
const { editionSize, assetElement } = require("../assets/config.js");

const serverUrl = process.env.REACT_APP_MORALIS_SERVER_URL;
const appId = process.env.REACT_APP_MORALIS_APPLICATION_ID;
const masterKey = process.env.MASTER_KEY;
const apiUrl = process.env.API_URL;
const apiKey = process.env.API_KEY;
// const serverUrl = "7eQm2cJULhF5ds8x72AjjpUslM7LuoLknjmpfsfD";
// const appId = "";
// const masterKey = "";
// const apiUrl = "";
// const apiKey = "";

Moralis.start({ serverUrl, appId, masterKey});

const btoa = (text) => {
  return Buffer.from(text, "binary").toString("base64");
}

// ローカルにmetadataを書き込み
const writeMetaData = (metadata) => {
  fs.writeFileSync("./hardhat/output/_metadata.json", JSON.stringify(metadata));
};

// モラリスにアップロード
const saveToDb = async (metaHash) => {
  for(let i = 0; i < editionSize; i++){
    let id = i.toString();
    // this operation is for ERC1155
    // let paddedHex = (
    //   "0000000000000000000000000000000000000000000000000000000000000000" + id
    // ).slice(-64);
    let url = `https://ipfs.moralis.io:2053/ipfs/${metaHash}/metadata/${id}`;
    let options = { json: true };
  
    request(url, options, (error, res, body) => {
      if (error) {
        return console.log(error);
      }
  
      if (!error && res.statusCode == 200) {
        // moralisのダッシュボードにセーブ
        const FileDatabase = new Moralis.Object("Metadata");
        FileDatabase.set("name", body.name);
        FileDatabase.set("description", body.description);
        FileDatabase.set("image", body.image);
        FileDatabase.set("attributes", body.animation_url);
        FileDatabase.set("meta_hash", metaHash);
        FileDatabase.save();
      }
    });
    console.log(`${i+1}/${editionSize} have been saved for moralis dashboard`)
  }
};

const uploadImage = async () => {
  const UrlArray = [];

  for (let i = 0; i < editionSize; i++) {
    let id = i.toString();
    let image_base64, music_base64, ifiletype, mfiletype;
    
    // データをIPFSにアップロード
    if(fs.existsSync(`./hardhat/assets/jackets/${id}.jpeg`)){
      image_base64 = await btoa(fs.readFileSync(`./hardhat/assets/jackets/${id}.jpeg`));
      ifiletype = "jpeg";
    } else if(fs.existsSync(`./hardhat/assets/jackets/${id}.png`)) {
      image_base64 = await btoa(fs.readFileSync(`./hardhat/assets/jackets/${id}.png`, (err,data) => {
        console.log(err)
      }));
      ifiletype = "png";
    } else if(fs.existsSync(`./hardhat/assets/jackets/${id}.gif`)) {
      image_base64 = await btoa(fs.readFileSync(`./hardhat/assets/jackets/${id}.gif`, (err,data) => {
        console.log(err)
      }));
      ifiletype = "gif";
    } else {
      console.log("jackets are not exist.")
    }
    if(fs.existsSync(`./hardhat/assets/sounds/sound.mp3`)){
      music_base64 = await btoa(fs.readFileSync(`./hardhat/assets/sounds/sound.mp3`));
      mfiletype = "mp3";
    } else {
      console.log("sounds are not exist.")
    }
    // else if(fs.existsSync(`./asset/${id}/music.mp3`)) {
    //   music_base64 = await btoa(fs.readFileSync(`./asset/${id}/music.mp3`));
    //   mfiletype = "mp3";
    // } else if(fs.existsSync(`./asset/${id}/music.mp4`)) {
    //   music_base64 = await btoa(fs.readFileSync(`./asset/${id}/music.mp4`, (err,data) => {
    //     console.log(err)
    //   }));
    //   mfiletype = "mp3";
    // }

    let image_file = new Moralis.File("image.png", { base64: `data:image/${ifiletype};base64,${image_base64}` });
    let music_file = new Moralis.File("music.mp3", { base64: `data:audio/${mfiletype};base64,${music_base64}` });
    await image_file.saveIPFS({ useMasterKey: true });
    await music_file.saveIPFS({ useMasterKey: true });
    console.log(`Processing ${i+1}/${editionSize}...`)
    console.log("IPFS address of Image: ", image_file.ipfs());
    console.log("IPFS address of Music: ", music_file.ipfs());

    UrlArray.push({
      imageURL:image_file.ipfs(), 
      musicURL:music_file.ipfs()
    })
  }

  console.log(UrlArray)
  return UrlArray
}

const createMetadata = async () => {

  const metaDataArray = [];
  const DataArray  = await uploadImage();

  for (let i = 0; i < editionSize; i++){
    let id = (i).toString()
    let imageURL = DataArray[i].imageURL
    let musicURL = DataArray[i].musicURL
  
    // メタデータを記述
    let metadata = {
      "name": assetElement.name,
      "description": assetElement.description,
      "image": imageURL,
      "animation_url": musicURL,
      "attributes": assetElement.attributes
    }
    metaDataArray.push(metadata);
  
    fs.writeFileSync(
      `./hardhat/output/${id}.json`,
      JSON.stringify(metadata)
    );
  }
  writeMetaData(metaDataArray);
}

const uploadMetadata = async () => {
  const promiseArray = []; 
  const ipfsArray = []; 

  for(let i = 0; i < editionSize; i++){
    let id = i.toString();
    // This 
    // let paddedHex = (
    //   "0000000000000000000000000000000000000000000000000000000000000000" + id
    // ).slice(-64);
  
    // jsonファイルをipfsArrayにpush
    promiseArray.push(
      new Promise((res, rej) => {
        fs.readFile(`./hardhat/output/${id}.json`, (err, data) => {
          if (err) rej();
          ipfsArray.push({
            path: `metadata/${id}`,
            content: data.toString("base64")
          });
          res();
        });
      })
    );
  }

  //プロミスが返ってきたらipfsArrayをapiにpost
  Promise.all(promiseArray).then(() => {
  axios
    .post(apiUrl, ipfsArray, {
      headers: {
        "X-API-Key": apiKey,
        "content-type": "application/json",
        accept: "application/json"
      }
    })
    .then(res => {
      let metaCID = res.data[0].path.split("/")[4];
      console.log("META FILE PATHS:", res.data);
      //モラリスにアップロード
      saveToDb(metaCID);
      console.log("all saved")
    })
    .catch(err => {
      console.log(err);
    });
  });
};

const startCreating = async () => {
  await createMetadata();
  await uploadMetadata();
  console.log("All finished!")
};

startCreating();
