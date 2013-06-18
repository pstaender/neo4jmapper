do ->
  return null
  
  $(document).ready ->
    width = 960
    height = 500
    fill = d3.scale.category20()
    # initialize with a single node
    force = d3.layout.force().size([width, height]).nodes([{}]).linkDistance(30).charge(-60)#.on("tick", tick)
    svg = d3
      .select("#visualization")
      .append("svg")
      .attr("width", width)
      .attr("height", height)
    
    svg
      .append("rect")
      .attr("width", width)
      .attr "height", height
    
    nodes = force.nodes()
    links = force.links()
    node = svg.selectAll(".node")
    link = svg.selectAll(".link")
    
    cursor = svg.append("circle").attr("r", 30).attr("transform", "translate(-100,-100)").attr("class", "cursor")

    restart = ->
      link = link.data(links)

      link
        .enter()
        .insert("line", ".node")
        .attr("class", "link");

      node = node.data(nodes)

      node
        .enter()
        .insert("circle", ".cursor")
        .attr("class", "node")
        .attr("r", 5)
        .call(force.drag)

      force.start()

    # init = ->
    #   node = {x: 100, y: 100}
    #   n = nodes.push(node)

    # init()

    restart()
