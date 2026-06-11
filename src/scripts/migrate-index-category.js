// import mongoose from 'mongoose';
// import dotenv from 'dotenv';
// import Category from '../modules/market/category/category.model';
// import Index from '../modules/market/index/index.model';

// dotenv.config();

// const MONGO_URI = process.env.MONGO_URI || process.env.DB_URL;

// const categoryMap = {
//   Indian: 'Indian Indices',
//   Global: 'Global Indices',
//   Crypto: 'Crypto',
// };

// const run = async () => {
//   await mongoose.connect(MONGO_URI);
//   console.log('MongoDB connected');

//   const oldIndices = await Index.find({
//     category: { $type: 'string' },
//   });

//   console.log(`Found ${oldIndices.length} old index records`);

//   for (const item of oldIndices) {
//     const oldCategory = item.category;
//     const categoryName = categoryMap[oldCategory];

//     if (!categoryName) {
//       console.log(`Skipping ${item.name} - unknown category: ${oldCategory}`);
//       continue;
//     }

//     const categoryDoc = await Category.findOne({ name: categoryName });

//     if (!categoryDoc) {
//       console.log(`Category not found for ${categoryName}`);
//       continue;
//     }

//     item.category = categoryDoc._id;
//     await item.save();

//     console.log(`Updated ${item.name}: ${oldCategory} -> ${categoryDoc._id}`);
//   }

//   console.log('Migration completed');
//   process.exit(0);
// };

// run().catch((err) => {
//   console.error(err);
//   process.exit(1);
// });