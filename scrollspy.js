$(document).ready(function() {
    $(window).scroll(function() {
        // Get the current scroll position
        var position = $(this).scrollTop();

        // Iterate through content sections
        $('#content > section').each(function() {
            var target = $(this).offset().top;

            var id = $(this).attr('id'); // get the ID of the current section
            var navLink = $('#scrollspy a[href="#' + id + '"]');

            // If this section is in the viewport
            if (position >= target - 100) {
                $('#scrollspy a').removeClass('active');
                navLink.addClass('active');
            } else {
                navLink.removeClass('active');
            }
        });
    });

    // Smooth scrolling with offset for the top nav
    $('#scrollspy a').click(function(event) {
        event.preventDefault();
        var target = $(this.hash);
        $('html, body').animate({
            scrollTop: target.offset().top - 48 // Subtracting 40 for the top nav offset
        }, 600);
    });
});
