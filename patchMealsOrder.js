const admin = require('firebase-admin');
const serviceAccount = require('./path/to/your-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function patchOrders() {
  const menuDoc = await db.collection('menus').doc('luqma').get();
  if (!menuDoc.exists) {
    console.log('Menu not found!');
    return;
  }
  const data = menuDoc.data();
  const items = data.items || {};

  let changed = false;

  for (const [catId, meals] of Object.entries(items)) {
    let needsUpdate = false;
    const patchedMeals = meals.map((meal, idx) => {
      if (meal.order !== idx) {
        needsUpdate = true;
        changed = true;
        return { ...meal, order: idx };
      }
      return meal;
    });
    if (needsUpdate) {
      await db.collection('menus').doc('luqma').update({
        [`items.${catId}`]: patchedMeals
      });
      console.log(`Updated order for category: ${catId}`);
    }
  }

  if (!changed) {
    console.log('No meals needed updating.');
  } else {
    console.log('All meals patched with order field!');
  }
}

patchOrders().then(() => process.exit()); 