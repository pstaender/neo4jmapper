$(document).ready ->

  $main = $('#main')
  content = $('#main').html()

  converter = new Showdown.converter()
  $main.html converter.makeHtml(content)
  
  # # lines = for line in content.split('\n')
  # #   line.trim()

  # md = content.replace(/```([a-z]*)/g, '\n`\n$1')#.replace(/```/g, '``')
  # console.log md
  # html = markdown.toHTML(md)



  # $main.html $(html)

  # $main.find('code').each ->
  #   firstline = $(this).html().split('\n')[1]
  #   lang = firstline?.match(/^[a-z]+\s*$/)?[0] or null
  #   # console.log firstline
  #   $(this).addClass lang
  #   $(this).html().replace(/^[a-z]+/)?[0]

