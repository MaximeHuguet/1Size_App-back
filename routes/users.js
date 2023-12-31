var express = require('express');
var router = express.Router();

require('../models/connection');
const User = require('../models/users');
const { checkBody } = require('../modules/checkBody');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const uid2 = require('uid2');
const bcrypt = require('bcrypt');
const uniqid = require('uniqid');

router.post('/signup', (req, res) => {
  if (!checkBody(req.body, ['nom', 'prenom','genre','username', 'email', 'motdepasse'])) {
    res.json({ result: false, error: 'Missing or empty fields' });
    return;
  }

  // Vérifier si le user est déjà inscrit (avec Regex pour recherche insensible à la casse)
  // regex superflue car la casse est déjà réglée en front (la route avait déjà été faites)
  User.findOne({ email: { $regex: new RegExp(req.body.email, 'i') } }).then(data => {
    if (data === null) {
      const hash = bcrypt.hashSync(req.body.motdepasse, 10);

      const newUser = new User({
        nom: req.body.nom,
        prenom: req.body.prenom,
        genre: req.body.genre,
        email: req.body.email,
        username: req.body.username,
        motdepasse: hash,
        token: uid2(32),
      });

      newUser.save().then(newDoc => {
        res.json({ result: true, data:newDoc });
      });
    } else {
      // User already exists in database
      res.json({ result: false, error: "L'adresse e-mail existe déjà" });
    }
  });
});

router.post('/signin', (req, res) => {
  if (!checkBody(req.body, ['email', 'motdepasse'])) {
    res.json({ result: false, error: 'Missing or empty fields' });
    return;
  }

 User.findOne({ email: { $regex: new RegExp(req.body.email, 'i') } }).then(data => {

   if (data && bcrypt.compareSync(req.body.motdepasse, data.motdepasse)) {
      res.json({ result: true, data });
    } else {
      res.json({ result: false, error: 'User not found or wrong password' });
    }
  });
});


router.get('/userdata/:token', (req, res) => 
User.findOne({ token: req.params.token }).then(data => {
  if (data) {
    res.json({ nom: data.nom, prenom: data.prenom, genre: data.genre, username: data.username, email: data.email, image: data.image });
  } else {
    res.json({ result: false, error: 'User not found' });
  }
})
);


// Route pour récupérer les vêtements de l’utilisateur d'une certaine catégorie (haut/bas/chaussures)
router.get('/userclothes', async (req, res) => {
  const { token, categorie } = req.query;
  const document = await User.findOne({ token: token });
  const mensurations = document.vetements[categorie]
  res.json(mensurations);
})
// Route pour récupérer tous les vêtements de l’utilisateur
router.get('/alluserclothes', async (req, res) => {
  const { token } = req.query;
  const document = await User.findOne({ token: token });
  const mensurations = document.vetements
  res.json(mensurations);
})

// Route pour récupérer tous les vêtements en attente de l’utilisateur
router.get('/allenattente', async (req, res) => {
  const { token } = req.query;
  const document = await User.findOne({ token: token });
  const enattente = document.vetementsenattente
  res.json(enattente);
})

//route pour checker si il a déjà des mensurations calibrées
router.get('/mensurations', async (req, res) => {
  const { token, categorie } = req.query;
  const document = await User.findOne({ token: token });
  const mensurations = document.mensurations[categorie]
  res.json(mensurations);
})

//upload la profil picture sur cloudinary
router.post('/upload', async (req, res) => {
  const photoPath = `tmp/${uniqid()}.jpg`
  console.log(req.files);
  const resultMove = await req.files.profilePic.mv(photoPath)
  if (!resultMove) {
    const resultCloudinary = await cloudinary.uploader.upload(photoPath);
    fs.unlinkSync(photoPath);
    res.json({ result: true, url: resultCloudinary.secure_url });
  } else {
    res.json({result:false, error:resultMove})
  }
 });


//update info user
//FIXME vérifier si le mail existe déjà s'il veut update son mail (comme dans signup)
router.post('/update', async (req, res) => {  
    User.findOneAndUpdate(
      { token: req.body.token },
      { $set: { 
        image: req.body.image,
        username: req.body.username,
        nom: req.body.nom,
        prenom: req.body.prenom,
        email: req.body.email,
        genre: req.body.genre 
        }
      },
      { new : true }
    )
    .then(updatedDoc => {
      if(updatedDoc) {
        res.json({ result: true, user: updatedDoc });
      } else {
        res.json({ result: false, error: 'User not found' });
      }
    })
})


// Route pour enregistrer un vêtement de l'utilisateur
router.post('/vetements/:categorie/:token', (req, res) => {
  
  const categorie = req.params.categorie

  const newItem = {
    marque: req.body.marque,
    type: req.body.type,
    coupe: req.body.coupe,
    taille: req.body.taille,
    mensurations : req.body.mensurations,
    fit : Boolean(req.body.fit)
  };

  User.findOneAndUpdate(
    { token: req.params.token },
    { $push: { [`vetements.${categorie}`]: newItem } },
    { new: true }
  )
    .then((result) => {
      console.log(result)
      if (result) {
        res.json({ result: true, message: 'Mise à jour réussie' });
      } else {
        res.json({
          result: false,
          error: 'Utilisateur non trouvé ou aucune mise à jour effectuée',
        });
      }
    })
    .catch((error) => {
      res.json({ result: false, error: 'Erreur serveur lors de la mise à jour' });
    });
});

// Route pour enregistrer un vêtement en attente de l'utilisateur
// Redondance avec la route précédente, on aurait sûrement pu rajouter une propriété "en attente" aux vêtements
router.post('/vetementsenattente/:categorie/:token', (req, res) => {
  
  const categorie = req.params.categorie
  console.log('body',req.body);

  const newItem = {
    marque: req.body.marque,
    type: req.body.type,
    coupe: req.body.coupe,
    taille: req.body.taille,
    mensurations : req.body.mensurations,
    fit : Boolean(req.body.fit)
  };

  User.findOneAndUpdate(
    { token: req.params.token },
    { $push: { [`vetementsenattente.${categorie}`]: newItem } },
    { new: true }
  )
    .then((result) => {
      console.log(result)
      if (result) {
        res.json({ result: true, message:"Mise à jour réussie"});
      } else {
        res.json({
          result: false,
          error: 'Utilisateur non trouvé ou aucune mise à jour effectuée',
        });
      }
    })
    .catch((error) => {
      res.json({ result: false, error: 'Erreur serveur lors de la mise à jour' });
    });
});

//Route pour supprimer un vêtement de l'utilisateur
router.delete('/vetements/:categorie/:token/:vetementId', (req, res) => {
  const categorie = req.params.categorie
  User.findOneAndUpdate(
    { token: req.params.token },
    { $pull: { [`vetements.${categorie}`] : { _id: req.params.vetementId } } },
    { new: true }
  )
    .then((result) => {
      console.log(result);
      if (result) {
        res.json({ result: true, message: 'Suppression réussie' });
      } else {
        res.json({
          result: false,
          error: 'Utilisateur non trouvé ou aucun vêtement supprimé',
        });
      }
    })
    .catch((error) => {
      res.json({ result: false, error: 'Erreur serveur lors de la suppression' });
    });
});

//Route pour supprimer un vêtement en attente de l'utilisateur
// Redondance avec la route précédente, on aurait sûrement pu rajouter une propriété "en attente" aux vêtements
router.delete('/enattente/:categorie/:token/:vetementId', (req, res) => {
  const categorie = req.params.categorie
  User.findOneAndUpdate(
    { token: req.params.token },
    { $pull: { [`vetementsenattente.${categorie}`] : { _id: req.params.vetementId } } },
    { new: true }
  )
    .then((result) => {
      console.log(result);
      if (result) {
        res.json({ result: true, message: 'Suppression réussie' });
      } else {
        res.json({
          result: false,
          error: 'Utilisateur non trouvé ou aucun vêtement en attente supprimé',
        });
      }
    })
    .catch((error) => {
      res.json({ result: false, error: 'Erreur serveur lors de la suppression' });
    });
});

// Route pour mettre à jour les mensurations HAUT de l'utilisateur
router.put('/mensurations/haut/:token', (req, res) => {
  const { firstValue, secondValue, thirdValue } = req.body

  // Mettre à jour les mensurations
  User.findOneAndUpdate(
    { token: req.params.token },
    {
      $set: {
        'mensurations.haut.tourDePoitrine': firstValue,
        'mensurations.haut.tourDeTaille': secondValue,
        'mensurations.haut.tourDeHanches': thirdValue,
      },
    },
    { new : true }
  )
    .then(result => {

      if (result) {
        res.json({ result: true, message: 'Vos mensurations ont été mises à jour.' });
      } else {
        res.json({ result: false, error: "Erreur, la mise à jour n'a pas pu être effectuée" });
      }
    })
    .catch(error => {
      res.json({ result: false, error: 'Erreur serveur lors de la mise à jour' });
    });
});

// Route pour mettre à jour les mensurations BAS de l'utilisateur
router.put('/mensurations/bas/:token', (req, res) => {
  
  const {firstValue, secondValue, thirdValue} = req.body

  // Mettre à jour les mensurations 
  User.findOneAndUpdate(
    { token: req.params.token },
    {
      $set: {
        'mensurations.bas.tourDeBassin': firstValue,
        'mensurations.bas.tourDeTaille': secondValue,
        'mensurations.bas.longueurJambe': thirdValue,
      },
    },
    { new : true }
  )
    .then(result => {

      if (result) {
        res.json({ result: true, message: 'Vos mensurations ont été mises à jour.' });
      } else {
        res.json({ result: false, error: 'Utilisateur non trouvé ou aucune mise à jour effectuée' });
      }
    })
    .catch(error => {
      res.json({ result: false, error: 'Erreur serveur lors de la mise à jour' });
    });
});

// Route pour mettre à jour les mensurations CHAUSSURES de l'utilisateur
router.put('/mensurations/chaussures/:token', (req, res) => {

  const { firstValue, secondValue } = req.body 

  // Mettre à jour les mensurations
  User.findOneAndUpdate(
    { token: req.params.token },
    {
      $set: {
        'mensurations.chaussures.longueur': firstValue,
        'mensurations.chaussures.pointure': secondValue,
      },
    },
    { new : true }
  )
    .then(result => {

      if (result) {
        res.json({ result: true, message: 'Vos mensurations ont été mises à jour.' });
      } else {
        res.json({ result: false, error: 'Utilisateur non trouvé ou aucune mise à jour effectuée' });
      }
    })
    .catch(error => {
      res.json({ result: false, error: 'Erreur serveur lors de la mise à jour' });
    });
});


// Affiche la liste d'amis d'un utilisateur
router.get('/friends', async (req, res) => {
  const { token } = req.query;

  const document = await User.findOne({ token: token }).populate('amis');

  if (!document) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Tri des amis par 'username' en ordre alphabétique
  // localCompare est plus propre que simplement un "-" pour les chaînes de caractères
  const sortedFriends = document.amis.sort((a, b) => a.username.localeCompare(b.username));

  res.json(sortedFriends);
});


// Permet d'ajouter un nouvel ami par usersame
router.post('/addfriend', async (req, res) => {
  const { token, friendUsername } = req.body;
  
  const user = await User.findOne({ token: token });
  const friend = await User.findOne({ username: friendUsername });

  if (!friend) {
      return res.status(404).json({ message: "Ami non trouvé" });
  }

  // Vérifier si l'ami est déjà dans la liste
  if (user.amis.includes(friend._id)) {
      return res.status(400).json({ message: "L'ami est déjà dans votre liste" });
  }

  user.amis.push(friend._id);
  await user.save();

  res.json({ success: true, message: "Ami ajouté avec succès!" });
});

// Permet de supprimer un ami par username
router.delete('/deletefriend', async (req, res) => {
  const { token, friendId } = req.body;
  
  const user = await User.findOne({ token: token });


  // Vérifier si l'ami est dans la liste
  if (!user.amis.includes(friendId)) {
      return res.status(400).json({ message: "L'ami n'est pas dans votre liste" });
  }

  // Supprimer l'ami de la liste
  user.amis.pull(friendId);
  await user.save();

  res.json({ success: true, message: "Ami supprimé avec succès!" });
});


// permet d'afficher la liste des utilisateurs selon le username (ou une partie du username)
router.get('/searchfriend', async (req, res) => {
  const { username } = req.query;
  const users = await User.find({ username: new RegExp(username, 'i') });
  return res.json(users);
});

module.exports = router;
