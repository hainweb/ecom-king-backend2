var express = require('express');
var router = express.Router();
var productHelpers = require('../helpers/product-helpers');
var userHelpers = require('../helpers/user-helpers');
const sgMail = require('@sendgrid/mail');
const crypto = require('crypto');
require('dotenv').config(); // Ensure this is at the top of your file



sgMail.setApiKey(process.env.SENDERGRID_API); // Replace with your SendGrid API key to send emails 


console.log('SendGrid API Key:', process.env.SENDERGRID_API);
  

const verifyLogin = (req, res, next) => {
  if (req.session.user && req.session.user.loggedIn) {
    next();
  } else {
    res.redirect('/login');
  }
};

/* GET home page. */
router.get('/api/products', async function (req, res, next) {
  
  let user = req.session.user;
  let cartCount = null;
  console.log('session', req.session.user);
  if (user) {
    console.log('in user'); 

    // Fetch cart count and wishlist 
    cartCount = await userHelpers.getCartCount(req.session.user._id);
    let wishlist = await userHelpers.getWishlist(req.session.user._id);

    // Fetch products
    let products = await productHelpers.getAllProducts();

    // Mark products that are in the wishlist
    products.forEach(product => {
      product.isInWishlist = wishlist.products.some(item => item.item.toString() === product._id.toString());
    });

    // Render the page with products, user, cartCount, and wishlist status

    res.json({ products, user, cartCount })
  } else {
    console.log('no user');

    // If no user is logged in, fetch products and render the page without wishlist
    productHelpers.getAllProducts().then((products) => {
      res.json({ products })
    });
  }
});

router.get('/api/login', (req, res) => {
  console.log('Session User:', req.session.user); // Log session user data for debugging
  if (req.session.user && req.session.user.loggedIn) {
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    res.json({ loggedIn: false, message: req.session.info });
    req.session.info = false;
  }
});

router.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  // Check if the lockout period has expired
  if (req.session.lockedOutUntil && req.session.lockedOutUntil <= Date.now()) {
    req.session.failedAttempts = 0; // Reset failed attempts after lockout expires
    req.session.lockedOutUntil = null; // Clear lockout status
  }

  // Check if the user is currently locked out
  if (req.session.lockedOutUntil && req.session.lockedOutUntil > Date.now()) {
    const timeLeft = Math.ceil((req.session.lockedOutUntil - Date.now()) / 1000); // time left in seconds
    return res.json({ loggedIn: false, timeLeft, message: `Too many failed attempts. Try again in ${timeLeft} seconds.` });
  }

  // Ensure failed attempts are initialized
  if (!req.session.failedAttempts) {
    req.session.failedAttempts = 0;
  }

  userHelpers.doLogin(req.body).then((response) => {
    if (response.status) {
      req.session.user = { loggedIn: true, ...response.user };
      req.session.failedAttempts = 0; // Reset failed attempts after successful login
      console.log('session', req.session.user);
      res.json({ loggedIn: true, user: req.session.user });
    } else {
      req.session.failedAttempts += 1; // Increment failed attempts counter

      if (req.session.failedAttempts >= 10) {
        req.session.lockedOutUntil = Date.now() + 2 * 60 * 1000; // Lock the user for 2 minutes
        res.json({ loggedIn: false, timeLeft: 120, message: 'Too many failed attempts. Please try again in 2 minutes.' });
      } else {
        req.session.loginErr = 'Invalid username or password';
        res.json({ loggedIn: false, message: req.session.loginErr });
      }
    }
  });
});



const otpStore = {};

// Send OTP Endpoint
// Store OTP request count and last request time
const otpRequestCountStore = {}; // Stores the count of OTP requests
const otpRequestTimeStore = {};  // Stores the last OTP request time for each user

router.post('/api/forgot-send-otp', (req, res) => {

  const { Email, Name, Mobile } = req.body;

  console.log('api all to send otp', req.body);

  // Validate the email, name, and mobile
  if (!Email || !Name || !Mobile) {
    return res.json({ status: false, message: 'All fields are required' });
    console.log('all fields required');
  }

  // Check the number of OTP requests
  const otpRequestCount = otpRequestCountStore[Email] || 0;
  const lastOtpRequestTime = otpRequestTimeStore[Email];

  if (otpRequestCount >= 12) {
    // Check if 2 hours have passed since the last OTP request
    const timeDifference = Date.now() - lastOtpRequestTime;

    if (timeDifference < 2 * 60 * 60 * 1000) {
      const remainingTime = Math.ceil((2 * 60 * 60 * 1000 - timeDifference) / (60 * 1000)); // Remaining time in minutes
      return res.json({ status: false, message: `You have reached the maximum OTP requests. Please try again after ${remainingTime} minutes.` });
    } else {
      // Reset the OTP request count and allow new requests
      otpRequestCountStore[Email] = 0; // Reset after 2 hours
    }
  }

  // Proceed with signup if valid


  // Generate a 6-digit OTP
  const otp = crypto.randomInt(100000, 999999).toString();

  // Save OTP in the store with a 10-minute expiration
  otpStore[Email] = { otp, expiresAt: Date.now() + 10 * 60 * 1000 };

  // Increment OTP request count
  otpRequestCountStore[Email] = otpRequestCount + 1;

  // Save the current time for the OTP request
  otpRequestTimeStore[Email] = Date.now();

  // Send OTP using SendGrid
  const msg = {
    to: Email,
    from: 'kingcart.ecom@gmail.com', // Replace with your verified sender email
    subject: 'Your OTP Code',
    text: `Hello ${Name},\n\nYour OTP code is ${otp}. This code will expire in 10 minutes.\n\nThank you!`,
  };

  sgMail
    .send(msg)
    .then(() => {
      res.json({ status: true, message: 'OTP sent successfully.' });
    })
    .catch((error) => {
      console.error('Error sending email:');
      res.json({ status: false, message: 'Failed to send OTP. Please try again.' });
    });



});

router.post('/api/send-otp', (req, res) => {
  
  const { Email, Name, Mobile } = req.body;

  console.log('api all to send otp', req.body);

  // Validate the email, name, and mobile
  if (!Email || !Name || !Mobile) {
    return res.json({ status: false, message: 'All fields are required' });
    console.log('all fields required');
  }

  // Check the number of OTP requests
  const otpRequestCount = otpRequestCountStore[Email] || 0;
  const lastOtpRequestTime = otpRequestTimeStore[Email];

  if (otpRequestCount >= 2) {
    // Check if 2 hours have passed since the last OTP request
    const timeDifference = Date.now() - lastOtpRequestTime;

    if (timeDifference < 2 * 60 * 60 * 1000) {
      const remainingTime = Math.ceil((2 * 60 * 60 * 1000 - timeDifference) / (60 * 1000)); // Remaining time in minutes
      return res.json({ status: false, message: `You have reached the maximum OTP requests. Please try again after ${remainingTime} minutes.` });
    } else {
      // Reset the OTP request count and allow new requests
      otpRequestCountStore[Email] = 0; // Reset after 2 hours
    }
  }

  // Proceed with signup if valid
  userHelpers.doSignup(req.body, true).then((response1) => {
    console.log('response1', response1);
    if (response1.status) {
      // Generate a 6-digit OTP
      const otp = crypto.randomInt(100000, 999999).toString();

      // Save OTP in the store with a 10-minute expiration
      otpStore[Email] = { otp, expiresAt: Date.now() + 10 * 60 * 1000 };

      // Increment OTP request count
      otpRequestCountStore[Email] = otpRequestCount + 1;

      // Save the current time for the OTP request
      otpRequestTimeStore[Email] = Date.now();

      // Send OTP using SendGrid
      const msg = {
        to: Email,
        from: 'kingcart.ecom@gmail.com', // Replace with your verified sender email
        subject: 'Your OTP Code',
        text: `Hello ${Name},\n\nYour OTP code is ${otp}. This code will expire in 10 minutes.\n\nThank you!`,
      };

      sgMail
        .send(msg)
        .then(() => {
          res.json({ status: true, message: 'OTP sent successfully.' });
        })
        .catch((error) => {
          console.error('Error sending email:', error.response.body);
          res.json({ status: false, message: 'Failed to send OTP. Please try again.' });
        });


    } else {
      res.json(response1);
    }
  });
});


// Verify OTP Endpoint
// Store for tracking failed OTP attempts and timestamps
const failedAttemptsStore = {};

router.post('/api/verify-otp', (req, res) => {
  const { Email, otp } = req.body;
  console.log('Api call to verify otp', req.body);

  let forgot = req.body.forgot || false;
  console.log('Forgot flag:', forgot);

  // Validate inputs
  if (!Email || !otp) {
    console.log('Error: Missing Email or OTP');
    return res.json({ status: false, message: 'Email and OTP are required' });
  }

  // Check failed attempts for this email
  if (failedAttemptsStore[Email]) {
    const { attempts, lastAttemptTime } = failedAttemptsStore[Email];

    // Block further attempts for 2 minutes after 5 failed attempts
    if (attempts >= 5 && Date.now() - lastAttemptTime < 2 * 60 * 1000) {
      console.log(`Too many failed attempts for ${Email}. Please try again after 2 minutes.`);
      return res.json({
        status: false,
        message: 'Too many failed attempts. Please try again after 2 minutes.'
      });
    }

    // Reset the attempts counter if 2 minutes have passed
    if (Date.now() - lastAttemptTime >= 2 * 60 * 1000) {
      failedAttemptsStore[Email] = { attempts: 0, lastAttemptTime: Date.now() };
    }
  } else {
    // Initialize failed attempts for the email if not already present
    failedAttemptsStore[Email] = { attempts: 0, lastAttemptTime: Date.now() };
  }

  const storedOtp = otpStore[Email];
  console.log('Stored OTP:', storedOtp);

  // Check if OTP exists and is not expired
  if (!storedOtp || storedOtp.expiresAt < Date.now()) {
    console.log('Error: OTP has expired for', Email);
    return res.json({ status: false, message: 'OTP has expired. Please request a new one.' });
  }

  // Verify OTP
  if (storedOtp.otp !== otp) {
    // Increment failed attempts
    failedAttemptsStore[Email].attempts += 1;
    failedAttemptsStore[Email].lastAttemptTime = Date.now();
    console.log(`Invalid OTP for ${Email}. Failed attempts: ${failedAttemptsStore[Email].attempts}`);
    return res.json({ status: false, message: 'Invalid OTP. Please try again.' });
  }

  // OTP is valid - remove from store and proceed
  delete otpStore[Email];
  console.log('OTP validated for', Email);

  // If "forgot" flag is true, skip signup and proceed
  if (forgot) {
    console.log('Forgot flag is true. Proceeding with password reset process.');
    return res.json({ status: true, message: 'OTP verified. Proceed with password reset.' });
  } else {
    // Proceed with signup
    let userData = {
      Name: req.body.Name,
      LastName: req.body.LastName,
      Gender: req.body.Gender,
      Mobile: req.body.Mobile,
      Email: req.body.Email,
      Password: req.body.Password,
    };

    console.log('User data for signup:', userData);

    userHelpers.doSignup(userData).then((response1) => {
      console.log('Signup response:', response1);
      if (response1.status) {
        req.session.user = { loggedIn: true, ...response1.user };
        console.log('User session:', req.session.user);
        res.json({ status: true, user: req.session.user });
      } else {
        req.session.signupErr = 'This number is already taken';
        console.log('Signup error:', req.session.signupErr);
        res.json(response1);
      }
    }).catch((error) => {
      console.log('Error during signup:', error);
      res.json({ status: false, message: 'Error during signup. Please try again later.' });
    });
  }
});





router.post('/api/signup', (req, res) => {
  console.log('api call signup');

  userHelpers.doSignup(req.body).then((response1) => {
    console.log('resoponse1', response1)
    if (response1.status) {
      req.session.user = { loggedIn: true, ...response1.user };
      res.json({ status: true, user: req.session.user });
    } else {
      req.session.signupErr = 'This number is already taken';
      res.json({ status: false });
    }
  });
});


router.post('/api/find-user', (req, res) => {
  console.log('api call to find acc', req.body);

  userHelpers.doSignup(req.body, false, true).then((response1) => {
    console.log('resoponse1', response1)

    res.json(response1)

  });

})


router.post('/api/change-password', (req, res) => {
  console.log('Api call to change pss', req.body);

  userHelpers.changePassword(req.body).then((response) => {
    res.json(response)
  })
})


router.get('/api/logout', (req, res) => {
  console.log('api call');

  req.session.user = null
  res.json({ logout: true })
})
router.get('/api/cart', verifyLogin, async (req, res) => {
  let username = req.session.user
  let user = req.session.user._id


  let cartCount = null
  if (req.session.user) {

    cartCount = await userHelpers.getCartCount(req.session.user._id)
  }
  let products = await userHelpers.getCartProducts(req.session.user._id);

  let total = await userHelpers.getTotalAmount(req.session.user._id)
  res.json({ products, user, total, cartCount, username }); // Pass the product details to the cart template

});


router.get('/api/add-to-cart/:id', verifyLogin, (req, res) => {
  console.log('api call done');

  let proId = req.params.id
  let userId = req.session.user._id
  userHelpers.addToCart(proId, userId).then((response) => {
    res.json(response)

  })
})
router.post('/api/change-productQuantity', (req, res) => {
  console.log('api call qq', req.body);

  userHelpers.changeProductQuantity(req.body).then(async (response) => {
    response.total = await userHelpers.getTotalAmount(req.body.user)
    res.json(response)
  })
})
router.get('/api/place-order', verifyLogin, async (req, res) => {
  let total = await userHelpers.getTotalAmount(req.session.user._id)
  res.json({ user: req.session.user, total })
})
router.post('/api/place-order', verifyLogin, async (req, res) => {
  let proId = req.body.proId
  let addressId = req.body.addressId
  let user = req.session.user._id
  let buyNow = req.body.buyNow
  console.log('api call place', req.body, addressId);
  let address = await userHelpers.getOrderAddress(addressId, user)

  if (buyNow) {
    let product = await productHelpers.getProduct(proId)
    let total = product.Price

    userHelpers.addOrders(address, product, total, user, buyNow).then((response) => {
      res.json(response)
    })

  } else {

    let products = await userHelpers.getCartProducts(req.session.user._id)
    let totalPrice = await userHelpers.getTotalAmount(req.session.user._id)

    userHelpers.addOrders(address, products, totalPrice, user).then((response) => {
      res.json(response)
    })
  }


})





router.post('/api/buy-product', async (req, res) => {
  let proId = req.body.proId
  console.log('api buy', req.body);

  let product = await productHelpers.getProduct(proId)
  let total = product.Price
  console.log('total', total);

  res.json({ total, product })

})





router.get('/order-success', verifyLogin, (req, res) => {
  res.json('user/order-success')
})
router.get('/api/view-orders', verifyLogin, async (req, res) => {
  console.log('api call order');

  let orders = await userHelpers.getOrders(req.session.user._id)
  res.json({ user: req.session.user, orders })
})
router.get('/api/view-orders-products/:Id', verifyLogin, async (req, res) => {
  let orderId = req.params.Id
  let products = await userHelpers.getOrderedProducts(orderId)
  let ordertrack = await userHelpers.getTrackOrders(req.params.Id)
  console.log('orderid', orderId);
  console.log("products is ", products);
  console.log("Ordertrack is", ordertrack);

  res.json({ user: req.session.user, products, ordertrack })
})
router.get('/api/wishlist', verifyLogin, async (req, res) => {
  let wishlistItems = await userHelpers.getWishlistProducts(req.session.user._id)
  console.log("resolve", wishlistItems);

  res.json({ user: req.session.user, wishlistItems })
})
router.get('/api/add-to-Wishlist/:id', verifyLogin, (req, res) => {
  console.log("wish id is ", req.params.id);
  userHelpers.addToWishlist(req.params.id, req.session.user._id).then(() => {
    res.json({ status: true, message: 'Wishlist updated' });
  })
})

router.post('/api/cancel-order', (req, res) => {
  console.log('canceled id', req.body)
  userHelpers.cancelOrder(req.body.orderId, req.session.user._id).then((response) => {
    res.json(response)
  })
})

router.post('/api/return-product', (req, res) => {
  const { proId, orderId, check, reason, message } = req.body.returndata;
  console.log('return', req.body);
  userHelpers.returnProduct(proId, orderId, check, reason, message).then((response) => {
    res.json(response)
  })

})


router.post('/api/get-user-details', (req, res) => {
  console.log('api call to get user details');

  console.log(req.session.user);
  res.json(req.session.user)

})

router.post('/api/edit-profile', (req, res) => {
  console.log('api call to edit ');

  let userId = req.session.user._id
  userHelpers.editProfile(userId, req.body).then((response) => {
    req.session.user = response
    console.log('ress new ', response);

    console.log('new sess', req.session.user);

    res.json({ status: true })
  })
})

router.get('/api/get-address', (req, res) => {
  console.log('api call to get address ');

  let userId = req.session.user._id
  userHelpers.getAddress(userId).then((response) => {
    res.json(response)
  })
})

router.post('/api/add-address', (req, res) => {
  console.log('data in add address', req.body);
  let userId = req.session.user._id
  userHelpers.addAddress(userId, req.body).then((response) => {
    res.json(response)
  })
})

router.post('/api/edit-user-address', (req, res) => {
  let userId = req.session.user._id
  console.log('edit address', req.body);
  userHelpers.editUserAddress(req.body, userId).then((response) => {
    console.log('edit response', response);
    res.json(response)
  })

})

router.post('/api/delete-address', (req, res) => {
  console.log('delete api clal', req.body);
  userHelpers.deleteAddress(req.body.addressId, req.session.user._id).then((response) => {
    res.json(response)
  })

})


router.get('/api/get-categories', (req, res) => {
  console.log('api call to get ctae ');

  productHelpers.getCategories().then((response) => {
    res.json(response)
  })
})


router.get('/api/find-category-:thing', (req, res) => {
  console.log('api call to find parm id ', req.params.thing);
  let thing = req.params.thing

  productHelpers.findCategory(thing).then((response) => {
    res.json(response)
  })

})


router.get('/api/get-product/:id', async (req, res) => {
  let proId = req.params.id
  console.log('id rp', proId);

  let product = await productHelpers.getProduct(proId)
  let wishlist = await userHelpers.getWishlist(req.session.user._id);

  product.isInWishlist = wishlist.products.some(item => item.item.toString() === product._id.toString());
  console.log('pro wish', product);

  res.json(product)

})

router.get('/api/get-sliders', (req, res) => {
  userHelpers.getSlider().then((response) => {
    res.json(response)
  })
})

router.post('/api/contact-form', (req, res) => {


  console.log('api call to contact ', req.body);



  userHelpers.addContact(req.body).then((response) => {
    res.json(response)
  })
})

router.get('/api/dummyAddToCart', (req, res) => {
  res.status(200).send({ success: true })
})
module.exports = router;
