var express = require('express');
var router = express.Router();

require('../models/connection');
const Marque = require('../models/marques');

//Dans toutes les routes, possibilité de rendre homme/femme ou la categorie haut/bas/chaussure dynamique

//récupère le nom de toutes les marques en bdd
router.get('/names', async (req, res) => {
    const {categorie, sexe} = req.query // Recevoir la catégorie comme un paramètre de requète 
    //distinct récupère un tableau de nom (sans propriété) [adidas,...]
    //find aurait récupéré un tableau d'objet [{name:adidas},...]
    const marques = await Marque.distinct('name', { [`${sexe}.${categorie}`] : {$exists: true}})
    res.json(marques);
  });

// //récupère les logos de toutes les marques en bdd
router.get('/logos', async (req, res) => {
    const {categorie, sexe} = req.query;
    // Trouvez toutes les marques qui répondent au critère
    const marques = await Marque.find({ [`${sexe}.${categorie}`] : {$exists: true}},'name url')
    res.json(marques);
});

//récupère les différents types d'une marque 
router.get('/types', async (req, res) => {
    const { marque, sexe, categorie } = req.query;
    const document = await Marque.findOne({ name:marque });
    const types = Object.keys(document[sexe][categorie]); 
    res.json(types);
});

//récupère les différentes tailles d'un type d'une marque 
router.get('/tailles', async (req, res) => {
    const { marque, type, sexe, categorie } = req.query;
    const document = await Marque.findOne({ name: marque });
    const tailles = Object.keys(document[sexe][categorie][type]);
    res.json(tailles);
});

// Récupère les mensurations d'UNE taille d'UNE marque d'un vêtement
router.get('/onemensuration', async (req, res) => {
    const { marque, type, sexe, categorie, taille } = req.query;
    const document = await Marque.findOne({ name: marque });
    const tailles = Object.keys(document[sexe][categorie][type][taille]);
    res.json(tailles);
});
//récupère les différentes tailles d'un type d'une marque avec leurs mensurations et selon le sexe
router.get('/tailleswithmensurations', async (req, res) => {
    const { marque, type, sexe, categorie } = req.query;
    const document = await Marque.findOne({ name: marque });
    const tailles = document[sexe][categorie][type];
    res.json(tailles);
});

//récupère le tableau de taille correspondant au combo marque/categorie/type/taille
router.get('/tableau', async (req, res) => {
    const { marque, categorie, type, taille, sexe } = req.query;
    const document = await Marque.findOne({ name : marque })
    const tableauTaille = document[sexe][categorie][type][taille]
    res.json(tableauTaille)
})


module.exports = router;