function addToCart(proId) {
    $.ajax({
        url:'/add-to-cart/'+proId,
        method:'get',
        success:(response)=>{
            if(response.status){
           let count=$('#cart-count').html()
           count=parseInt(count)+1
           $("#cart-count").html(count)
            }
            alert(response)
        }
    })
}
function addShipping(orderId) {
  $.ajax({
    url: '/delivery/shipping/' + orderId,
    method: 'get',
    success: (response) => {
      if (response.status) {
        alert("You take product from godown")
        // Update the status directly on the page without reloading
        $(`#status-${orderId}`).text("Shipped");
        // Update the button for the next action
        $(`#btn-${orderId}`).attr('onclick', `addDelivering('${orderId}')`).text("Delivery").removeClass("btn-primary").addClass("btn-success");
      }
    }
  });
}

function addDelivering(orderId) {
  $.ajax({
    url: '/delivery/delivered/' + orderId,
    method: 'get',
    success: (response) => {
      if (response.status) {
        alert("You delivered product to client")
        // Update the status to 'Delivered'
        $(`#status-${orderId}`).text("Delivered");
        // Update the button for the next action (Cash Update)
        $(`#btn-${orderId}`).attr('onclick', `addCashadmin('${orderId}')`).text("Cash to admin").removeClass("btn-success").addClass("btn-warning");
      }
    }
  });
}

function addCashadmin(orderId) {
  $.ajax({
    url: '/delivery/cashupdate/' + orderId,
    method: 'get',
    success: (response) => {
      if (response.status) {
        // Mark the order as 'Completed'
        alert("You send cash to admin")
        $(`#status-${orderId}`).text("Completed");
        // Disable the button since the process is complete
        $(`#btn-${orderId}`).replaceWith('<button class="btn btn-dark" disabled>Completed</button>');
      }
    }
  });
}

function toggleWishlist(proId) {
  let checkbox = document.getElementById('product-' + proId);

  // Make an AJAX request to add/remove product from wishlist
  $.ajax({
    url: '/add-to-Wishlist/' + proId,
    method: 'get',
    success: (response) => {
      if (checkbox.checked) {
        // If the checkbox is checked, fill the heart red
        
        alert('Product added to wishlist');
      } else {
        // If the checkbox is unchecked, remove the red fill
        document.querySelector(`label[for='product-${proId}'] svg path`).setAttribute('fill', 'transparent');
       
        alert('Product removed from wishlist');
      }
    },
    error: (err) => {
      console.error(err);
    }
  });
}
