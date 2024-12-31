var db = require('../config/connection')
var collection = require('../config/collection')

const { ObjectId } = require('mongodb')
module.exports = {

    addProduct: (product, callback) => {

        db.get().collection(collection.PRODUCT_COLLECTION).insertOne(product).then((data) => {

            console.log('Added product data', data);

            callback(data.insertedId)

        })
    },
    getAllProducts: () => {
        return new Promise(async (resolve, reject) => {
            let products = await db.get().collection(collection.PRODUCT_COLLECTION).find().toArray()
            resolve(products)
        })
    },


    getProduct:(proId)=>{
        console.log('api call to ser',proId);
        
        return new Promise((resolve, reject) => {
            db.get().collection(collection.PRODUCT_COLLECTION).findOne({ _id: new ObjectId(proId) }).then((product) => {
                console.log('product',product);
                
                resolve(product)
            })
        })
    },


    deleteProduct: (proId) => {
        return new Promise((resolve, reject) => {
            db.get().collection(collection.PRODUCT_COLLECTION).deleteOne({ _id: new ObjectId(proId) }).then((response) => {
                console.log(response);

                resolve({ status: true })
            })
        })
    },
    getProductsDetails: (proId) => {
        return new Promise((resolve, reject) => {
            db.get().collection(collection.PRODUCT_COLLECTION).findOne({ _id: new ObjectId(proId) }).then((product) => {
                resolve(product)
            })
        })
    },
    updateProduct: (proId, proDetails) => {
        return new Promise((resolve, reject) => {
            db.get().collection(collection.PRODUCT_COLLECTION).updateOne({ _id: new ObjectId(proId) }, {
                $set: {
                    Name: proDetails.Name,
                    Price: proDetails.Price,
                    Category: proDetails.Category,
                    Description: proDetails.Description,
                    Quantity: proDetails.Quantity,
                    Return: proDetails.Return
                }
            }).then((response) => {
                resolve({ status: true })
            })
        })
    },
    getOrdersCount: (proId) => {
        return new Promise(async (resolve, reject) => {
            try {
                let result = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
                    { $match: { 'products.item': new ObjectId(proId) } }, // Match the specific product
                    { $unwind: '$products' }, // Deconstruct the products array
                    { $match: { 'products.item': new ObjectId(proId) } }, // Match again after unwind
                    { $group: { _id: null, totalQuantity: { $sum: '$products.quantity' } } } // Sum the quantity
                ]).toArray();

                let totalQuantity = result.length > 0 ? result[0].totalQuantity : 0;
                resolve(totalQuantity);
            } catch (error) {
                reject(error);
            }
        });
    },

    getCategoriesName: async () => {
        try {
            const categories = await db.get().collection(collection.PRODUCT_COLLECTION).aggregate([
                {
                    $group: {
                        _id: null, // We don't need to group by anything specific, just want the unique categories
                        categories: { $addToSet: "$Category" } // Adds unique categories to the 'categories' array
                    }
                },
                {
                    $project: {
                        _id: 0, // Exclude the _id field
                        categories: 1 // Include the categories field
                    }
                }
            ]).toArray();

            console.log('cate ', categories);


            return categories[0] ? categories[0].categories : []; // Return the list of categories
        } catch (error) {
            console.error('Error fetching categories:', error);
            return [];
        }
    },

    getCategories: () => {
        return new Promise((resolve, reject) => {
            console.log('API call to server to get categories');

            db.get().collection(collection.DISPLAY_COLLECTION)
                .findOne({})
                .then(result => {
                    if (result && result.categories) {
                        console.log('success', result.categories);

                        resolve(result.categories); // Resolve with the categories array
                    } else {
                        console.log('no cat');

                        reject('No categories found');
                    }
                })
                .catch(err => {
                    console.error('Error fetching categories:', err);
                    reject(err); // Reject with the error
                });
        });
    },

    deleteCategory: (catId) => {
        console.log('Category ID to delete:', catId);

        return new Promise((resolve, reject) => {
            db.get()
                .collection(collection.DISPLAY_COLLECTION)
                .updateOne(
                    {}, // Assuming there's only one document in the collection
                    { $pull: { categories: { id: new ObjectId(catId) } } } // Remove the category with the matching ID
                )
                .then((result) => {
                    if (result.modifiedCount > 0) {
                        console.log('Deletion successful');

                        db.get().collection(collection.DISPLAY_COLLECTION)
                            .findOne({})
                            .then((result) => {
                                if (result && result.categories) {
                                    console.log('success', result.categories);
                                    let categories = result.categories;

                                    resolve({
                                        status: true,
                                        message: 'Category deleted successfully',
                                        categories,
                                    });
                                } else {
                                    console.log('no cat');

                                    resolve({
                                        status: true,
                                        message: 'Category deleted successfully, but no categories found',
                                        categories: [],
                                    });
                                }
                            })
                            .catch((error) => {
                                console.error('Error fetching categories:', error.message);
                                reject({
                                    status: 'error',
                                    message: 'Error fetching categories after deletion',
                                });
                            });
                    } else {
                        console.log('Category not found or document missing');

                        resolve({
                            status: 'failed',
                            message: 'Category not found or document missing',
                        });
                    }
                })
                .catch((error) => {
                    console.error('Error during deletion:', error.message);

                    reject({
                        status: 'error',
                        message: error.message,
                    });
                });
        });
    },

    findCategory: (thing) => {
        console.log('API call to server with category:', thing);

        return new Promise(async (resolve, reject) => {

            // Querying the database
            let products = await db.get().collection(collection.PRODUCT_COLLECTION).find({ Category: thing }).toArray()
            console.log('products sss s s', products);
            resolve(products)

        });

    }








}