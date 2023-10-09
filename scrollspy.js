$(document).ready(function() {
    $(window).scroll(function() {
        // Get the current scroll position
        var position = $(this).scrollTop();

        // Iterate through content sections
        $('section').each(function() {
            var top = $(this).offset().top - 100;
            var bottom = top + $(this).outerHeight();
            if (position >= top && position <= bottom) {
                $('#scrollspy a').removeClass('active');
                var id = $(this).attr('id');
                $('#scrollspy a[href="#' + id + '"]').addClass('active');
            }
        });
    });

    // Smooth scrolling with offset for the top nav
    $('#scrollspy a').click(function(event) {
        event.preventDefault();
        var target = $(this.hash);
        $('html, body').animate({
            scrollTop: target.offset().top - 64 // Subtracting 40 for the top nav offset
        }, 600);
    });
});


$(document).ready(function() {
    var currentSection = 0; // start with 0, and increment on the first click

    // Get all the sections in an array
    const sections = $('body div section');

    // Dynamically get the number of sections
    const totalSections = sections.length;

    // Log the detected count to the console for debugging
    console.log("Total sections detected:", totalSections);

    $('#arrow-up').click(function() {
        currentSection--;
        if (currentSection < 0) {
            currentSection = totalSections - 1; // Loop back to the last section
        }
        scrollToSection(currentSection);
    });

    $('#arrow-down').click(function() {
        currentSection++;
        if (currentSection >= totalSections) {
            currentSection = 0; // Loop back to the first section
        }
        scrollToSection(currentSection);
    });

    function scrollToSection(sectionIndex) {
        $('html, body').animate({
            scrollTop: $(sections[sectionIndex]).offset().top -64
        }, 600);
    }
});


