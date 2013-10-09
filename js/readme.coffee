$(document).ready ->

  $main = $('#main')
  content = $('#main').html()

  converter = new Showdown.converter()
  $main.html converter.makeHtml(content)

  $('code').each (i, e) -> 
    $e = $(this)
    html = $e.html().replace(/&amp;lt;/g, '>').replace(/&amp;gt;/g, '>').replace(/&amp;amp;/g, '&');
    if $e.hasClass('js') or $e.hasClass('coffeescript') or $e.hasClass('sh')
      if $e.hasClass('js')
        $e.addClass('javascript')
      if $e.hasClass('sh')
        $e.addClass('bash')
      html = $e.html().replace(/&amp;lt;/g, '>').replace(/&amp;gt;/g, '>').replace(/&amp;amp;/g, '&');
      $e.html(html)
      hljs.highlightBlock(e)
    else
      $e.addClass 'no-highlight'


