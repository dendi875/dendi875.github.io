$(function(){{let t="animated pulse";$("article .article").hover(function(){$(this).addClass(t)},function(){$(this).removeClass(t)})}function t(e,i){if(0!==(e=$("#"+e)).length){let t=e.width();450<=t?t+=21:350<=t&&t<450?t+=18:300<=t&&t<350?t+=16:t+=14,$("#"+i).width(t)}}function e(){t("navContainer"),t("artDetail","prenext-posts"),$(".content").css("min-height",window.innerHeight-165)}$(".sidenav").sidenav(),e(),$(window).resize(function(){e()}),$("#articles").masonry({itemSelector:".article"}),AOS.init({easing:"ease-in-out-sine",duration:700,delay:100});{$("#articleContent a").attr("target","_blank"),$("#articleContent img").each(function(){var t=$(this).attr("src"),t=($(this).wrap('<div class="img-item" data-src="'+t+'" data-sub-html=".caption"></div>'),$(this).addClass("img-shadow img-margin"),$(this).attr("alt")),e=$(this).attr("title");let i="";void 0===t||""===t?void 0!==e&&""!==e&&(i=e):i=t,""!==i&&((e=document.createElement("div")).className="caption",(t=document.createElement("b")).className="center-caption",t.innerText=i,e.appendChild(t),this.insertAdjacentElement("afterend",e))}),$("#articleContent, #myGallery").lightGallery({selector:".img-item",subHtmlSelectorRelative:!0}),$(document).find("img[data-original]").each(function(){$(this).parent().attr("href",$(this).attr("data-original"))});const s=window.document.querySelector(".progress-bar");s&&new ScrollProgress((t,e)=>{s.style.width=100*e+"%"})}$(".modal").modal(),$("#backTop").click(function(){return $("body,html").animate({scrollTop:0},400),!1});let i=$("#headNav"),n=$(".top-scroll");function a(t){t<100?(i.addClass("nav-transparent"),n.slideUp(300)):(i.removeClass("nav-transparent"),n.slideDown(300))}a($(window).scrollTop()),$(window).scroll(function(){a($(window).scrollTop())}),$(".nav-menu>li").hover(function(){$(this).children("ul").stop(!0,!0).show(),$(this).addClass("nav-show").siblings("li").removeClass("nav-show")},function(){$(this).children("ul").stop(!0,!0).hide(),$(".nav-item.nav-show").removeClass("nav-show")}),$(".m-nav-item>a").on("click",function(){("none"==$(this).next("ul").css("display")?($(".m-nav-item").children("ul").slideUp(300),$(this).next("ul").slideDown(100),$(this).parent("li").addClass("m-nav-show").siblings("li")):($(this).next("ul").slideUp(100),$(".m-nav-item.m-nav-show"))).removeClass("m-nav-show")}),$(".tooltipped").tooltip()});