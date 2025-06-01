// ----------------------------------------------------------------------
// Forces
// ----------------------------------------------------------------------

import { SimulationLinkDatum, SimulationNodeDatum } from "./util.ts";

/**
 * A force is simply a function that modifies nodes’ positions or velocities; in this context, a force can apply a classical physical force such as electrical charge or gravity,
 * or it can resolve a geometric constraint, such as keeping nodes within a bounding box or keeping linked nodes a fixed distance apart.
 *
 * Forces typically read the node’s current position [x,y] and then add to (or subtract from) the node’s velocity [vx,vy].
 * However, forces may also “peek ahead” to the anticipated next position of the node, [x + vx,y + vy]; this is necessary for resolving geometric constraints through iterative relaxation.
 * Forces may also modify the position directly, which is sometimes useful to avoid adding energy to the simulation, such as when recentering the simulation in the viewport.
 *
 * Forces may optionally implement force.initialize to receive the simulation’s array of nodes.
 */
export interface Force<
    NodeDatum extends SimulationNodeDatum,
    LinkDatum extends SimulationLinkDatum<NodeDatum> | undefined,
> {
    /**
     * Apply this force, optionally observing the specified alpha.
     * Typically, the force is applied to the array of nodes previously passed to force.initialize,
     * however, some forces may apply to a subset of nodes, or behave differently.
     * For example, d3.forceLink applies to the source and target of each link.
     */
    (alpha: number): void;
    /**
     * Supplies the array of nodes and random source to this force. This method is called when a force is bound to a simulation via simulation.force
     * and when the simulation’s nodes change via simulation.nodes.
     *
     * A force may perform necessary work during initialization, such as evaluating per-node parameters, to avoid repeatedly performing work during each application of the force.
     */
    initialize?(nodes: NodeDatum[], random: () => number): void;
}

// Centering ------------------------------------------------------------

/**
 * The centering force translates nodes uniformly so that the mean position of all nodes
 * (the center of mass if all nodes have equal weight) is at the given position [x,y].
 * This force modifies the positions of nodes on each application; it does not modify velocities,
 * as doing so would typically cause the nodes to overshoot and oscillate around the desired center.
 * This force helps keeps nodes in the center of the viewport, and unlike the positioning force,
 * it does not distort their relative positions.
 *
 * The generic refers to the type of data for a node.
 */
export interface ForceCenter<NodeDatum extends SimulationNodeDatum> extends Force<NodeDatum, any> {
    /**
     * Supplies the array of nodes and random source to this force. This method is called when a force is bound to a simulation via simulation.force
     * and when the simulation’s nodes change via simulation.nodes.
     *
     * A force may perform necessary work during initialization, such as evaluating per-node parameters, to avoid repeatedly performing work during each application of the force.
     */
    initialize(nodes: NodeDatum[], random: () => number): void;

    /**
     * Return the current x-coordinate of the centering position, which defaults to zero.
     */
    x(): number;
    /**
     * Set the x-coordinate of the centering position.
     *
     * @param x x-coordinate.
     */
    x(x: number): this;

    /**
     * Return the current y-coordinate of the centering position, which defaults to zero.
     */
    y(): number;
    /**
     * Set the y-coordinate of the centering position.
     *
     * @param y y-coordinate.
     */
    y(y: number): this;

    /**
     * Returns the force’s current strength, which defaults to 1.
     */
    strength(): number;

    /**
     * Sets the centering force’s strength.
     * A reduced strength of e.g. 0.05 softens the movements on interactive graphs in which new nodes enter or exit the graph.
     * @param strength The centering force's strength.
     */
    strength(strength: number): this;
}

/**
 * Create a new centering force with the specified x- and y- coordinates.
 * If x and y are not specified, they default to [0,0].
 *
 * The centering force translates nodes uniformly so that the mean position of all nodes
 * (the center of mass if all nodes have equal weight) is at the given position [x,y].
 * This force modifies the positions of nodes on each application; it does not modify velocities,
 * as doing so would typically cause the nodes to overshoot and oscillate around the desired center.
 * This force helps keeps nodes in the center of the viewport, and unlike the positioning force,
 * it does not distort their relative positions.
 *
 * The generic refers to the type of data for a node.
 *
 * @param x An optional x-coordinate for the centering position, defaults to 0.
 * @param y An optional y-coordinate for the centering position, defaults to 0.
 */
// eslint-disable-next-line @definitelytyped/no-unnecessary-generics
export function forceCenter<NodeDatum extends SimulationNodeDatum>(x?: number, y?: number): ForceCenter<NodeDatum>;

// Collision ------------------------------------------------------------

/**
 * The collision force treats nodes as circles with a given radius, rather than points, and prevents nodes from overlapping.
 * More formally, two nodes a and b are separated so that the distance between a and b is at least radius(a) + radius(b).
 * To reduce jitter, this is by default a “soft” constraint with a configurable strength and iteration count.
 *
 * The generic refers to the type of data for a node.
 */
export interface ForceCollide<NodeDatum extends SimulationNodeDatum> extends Force<NodeDatum, any> {
    /**
     * Supplies the array of nodes and random source to this force. This method is called when a force is bound to a simulation via simulation.force
     * and when the simulation’s nodes change via simulation.nodes.
     *
     * A force may perform necessary work during initialization, such as evaluating per-node parameters, to avoid repeatedly performing work during each application of the force.
     */
    initialize(nodes: NodeDatum[], random: () => number): void;

    /**
     * Returns the current radius accessor function.
     */
    radius(): (node: NodeDatum, i: number, nodes: NodeDatum[]) => number;
    /**
     * Sets the radius accessor to the specified number or function, re-evaluates the radius accessor for each node, and returns this force.
     * The radius accessor is invoked for each node in the simulation, being passed the node and its zero-based index.
     * The resulting number is then stored internally, such that the radius of each node is only recomputed when the
     * force is initialized or when this method is called with a new radius, and not on every application of the force.
     */
    radius(radius: number | ((node: NodeDatum, i: number, nodes: NodeDatum[]) => number)): this;

    /**
     * Return the current strength, which defaults to 1.
     */
    strength(): number;
    /**
     * Set the force strength to the specified number in the range [0,1] and return this force.
     * The default strength is 1.
     *
     * Overlapping nodes are resolved through iterative relaxation.
     * For each node, the other nodes that are anticipated to overlap at the next tick (using the anticipated positions [x + vx,y + vy]) are determined;
     * the node’s velocity is then modified to push the node out of each overlapping node.
     * The change in velocity is dampened by the force’s strength such that the resolution of simultaneous overlaps can be blended together to find a stable solution.
     *
     * @param strength Strength.
     */
    strength(strength: number): this;

    /**
     * Return the current iteration count which defaults to 1.
     */
    iterations(): number;
    /**
     * Sets the number of iterations per application to the specified number and return this force.
     *
     * Increasing the number of iterations greatly increases the rigidity of the constraint and avoids partial overlap of nodes,
     * but also increases the runtime cost to evaluate the force.
     *
     * @param iterations Number of iterations.
     */
    iterations(iterations: number): this;
}

/**
 * Creates a new circle collision force with the specified radius.
 * If radius is not specified, it defaults to the constant one for all nodes.
 */
export function forceCollide<NodeDatum extends SimulationNodeDatum>(
    radius?: number | ((node: NodeDatum, i: number, nodes: NodeDatum[]) => number),
): ForceCollide<NodeDatum>;

// Link ----------------------------------------------------------------

/**
 * The link force pushes linked nodes together or apart according to the desired link distance.
 * The strength of the force is proportional to the difference between the linked nodes’ distance and the target distance, similar to a spring force.
 *
 * The first generic refers to the type of data for a node.
 * The second generic refers to the type of data for a link.
 */
export interface ForceLink<NodeDatum extends SimulationNodeDatum, LinkDatum extends SimulationLinkDatum<NodeDatum>>
    extends Force<NodeDatum, LinkDatum>
{
    /**
     * Supplies the array of nodes and random source to this force. This method is called when a force is bound to a simulation via simulation.force
     * and when the simulation’s nodes change via simulation.nodes.
     *
     * A force may perform necessary work during initialization, such as evaluating per-node parameters, to avoid repeatedly performing work during each application of the force.
     */
    initialize(nodes: NodeDatum[], random: () => number): void;

    /**
     * Return the current array of links, which defaults to the empty array.
     */
    links(): LinkDatum[];
    /**
     * Set the array of links associated with this force, recompute the distance and strength parameters for each link, and return this force.
     *
     * Each link is an object with the following properties:
     * * source - the link’s source node; see simulation.nodes
     * * target - the link’s target node; see simulation.nodes
     * * index - the zero-based index into links, assigned by this method
     *
     * For convenience, a link’s source and target properties may be initialized using numeric or string identifiers rather than object references; see link.id.
     * When the link force is initialized (or re-initialized, as when the nodes or links change), any link.source or link.target property which is not an object
     * is replaced by an object reference to the corresponding node with the given identifier.
     * If the specified array of links is modified, such as when links are added to or removed from the simulation,
     * this method must be called again with the new (or changed) array to notify the force of the change;
     * the force does not make a defensive copy of the specified array.
     *
     * @param links An array of link data.
     */
    links(links: LinkDatum[]): this;

    /**
     * Return the current node id accessor, which defaults to the numeric node.index.
     */
    id(): (node: NodeDatum, i: number, nodesData: NodeDatum[]) => string | number;
    /**
     * Set the node id accessor to the specified function and return this force.
     *
     * The default id accessor allows each link’s source and target to be specified as a zero-based index
     * into the nodes array.
     *
     * The id accessor is invoked for each node whenever the force is initialized,
     * as when the nodes or links change, being passed the node, the zero-based index of the node in the node array, and the node array.
     *
     * @param id A node id accessor function which is invoked for each node in the simulation,
     * being passed the node, the zero-based index of the node in the node array, and the node array. It returns a string or number to represent the node id which can be used
     * for matching link source and link target strings during the ForceLink initialization.
     */
    id(id: (node: NodeDatum, i: number, nodesData: NodeDatum[]) => string | number): this;

    /**
     * Return the current distance accessor, which defaults to implying a default distance of 30.
     */
    distance(): (link: LinkDatum, i: number, links: LinkDatum[]) => number;
    /**
     * Sets the distance accessor to the specified number or function, re-evaluates the distance accessor for each link, and returns this force.
     * The distance accessor is invoked for each link, being passed the link and its zero-based index.
     * The resulting number is then stored internally, such that the distance of each link is only recomputed when the
     * force is initialized or when this method is called with a new distance, and not on every application of the force.
     */
    distance(distance: number | ((link: LinkDatum, i: number, links: LinkDatum[]) => number)): this;

    /**
     * Return the current strength accessor.
     * For details regarding the default behavior see: {@link https://github.com/d3/d3-force#link_strength}
     */
    strength(): (link: LinkDatum, i: number, links: LinkDatum[]) => number;
    /**
     * Sets the strength accessor to the specified number or function, re-evaluates the strength accessor for each link, and returns this force.
     * The strength accessor is invoked for each link, being passed the link and its zero-based index.
     * The resulting number is then stored internally, such that the strength of each link is only recomputed when the
     * force is initialized or when this method is called with a new strength, and not on every application of the force.
     */
    strength(strength: number | ((link: LinkDatum, i: number, links: LinkDatum[]) => number)): this;

    /**
     * Return the current iteration count which defaults to 1.
     */
    iterations(): number;
    /**
     * Sets the number of iterations per application to the specified number and return this force.
     *
     * Increasing the number of iterations greatly increases the rigidity of the constraint and is useful for complex structures such as lattices,
     * but also increases the runtime cost to evaluate the force.
     *
     * @param iterations Number of iterations.
     */
    iterations(iterations: number): this;
}

/**
 * Creates a new link force with the specified links and default parameters.
 * If links is not specified, it defaults to the empty array.
 */
export function forceLink<NodeDatum extends SimulationNodeDatum, LinksDatum extends SimulationLinkDatum<NodeDatum>>(
    links?: LinksDatum[],
): ForceLink<NodeDatum, LinksDatum>;

// Many Body ----------------------------------------------------------------

/**
 * The many-body (or n-body) force applies mutually amongst all nodes. It can be used to simulate gravity (attraction) if the strength is positive,
 * or electrostatic charge (repulsion) if the strength is negative. This implementation uses quadtrees and the Barnes–Hut approximation to greatly
 * improve performance; the accuracy can be customized using the theta parameter.
 *
 * Unlike links, which only affect two linked nodes, the charge force is global: every node affects every other node, even if they are on disconnected subgraphs.
 *
 * The generic refers to the type of data for a node.
 */
export interface ForceManyBody<NodeDatum extends SimulationNodeDatum> extends Force<NodeDatum, any> {
    /**
     * Supplies the array of nodes and random source to this force. This method is called when a force is bound to a simulation via simulation.force
     * and when the simulation’s nodes change via simulation.nodes.
     *
     * A force may perform necessary work during initialization, such as evaluating per-node parameters, to avoid repeatedly performing work during each application of the force.
     */
    initialize(nodes: NodeDatum[], random: () => number): void;

    /**
     * Return the current strength accessor.
     *
     * For details regarding the default behavior see: {@link https://github.com/d3/d3-force#manyBody_strength}
     */
    strength(): (d: NodeDatum, i: number, data: NodeDatum[]) => number;
    /**
     * sets the strength accessor to the specified number or function, re-evaluates the strength accessor for each node, and returns this force.
     * A positive value causes nodes to attract each other, similar to gravity, while a negative value causes nodes to repel each other, similar to electrostatic charge.
     * The strength accessor is invoked for each node in the simulation, being passed the node and its zero-based index.
     * The resulting number is then stored internally, such that the strength of each node is only recomputed when the
     * force is initialized or when this method is called with a new strength, and not on every application of the force.
     */
    strength(strength: number | ((d: NodeDatum, i: number, data: NodeDatum[]) => number)): this;

    /**
     * Return the current value of the Barnes–Hut approximation criterion , which defaults to 0.9
     */
    theta(): number;
    /**
     * Set the Barnes–Hut approximation criterion to the specified number and returns this force.
     *
     * To accelerate computation, this force implements the Barnes–Hut approximation which takes O(n log n) per application
     * where n is the number of nodes. For each application, a quadtree stores the current node positions;
     * then for each node, the combined force of all other nodes on the given node is computed.
     * For a cluster of nodes that is far away, the charge force can be approximated by treating the cluster as a single, larger node.
     * The theta parameter determines the accuracy of the approximation:
     * if the ratio w / l of the width w of the quadtree cell to the distance l from the node to the cell’s center of mass is less than theta,
     * all nodes in the given cell are treated as a single node rather than individually.
     *
     * The default value is 0.9.
     *
     * @param theta Value for the theta parameter.
     */
    theta(theta: number): this;

    /**
     * Returns the current minimum distance over which this force is considered, which defaults to 1.
     */
    distanceMin(): number;
    /**
     * Sets the minimum distance between nodes over which this force is considered.
     *
     * A minimum distance establishes an upper bound on the strength of the force between two nearby nodes, avoiding instability.
     * In particular, it avoids an infinitely-strong force if two nodes are exactly coincident; in this case, the direction of the force is random.
     *
     * The default value is 1.
     *
     * @param distance The minimum distance between nodes over which this force is considered.
     */
    distanceMin(distance: number): this;

    /**
     * Returns the current maximum distance over which this force is considered, which defaults to infinity.
     */
    distanceMax(): number;
    /**
     * Sets the maximum distance between nodes over which this force is considered.
     *
     * Specifying a finite maximum distance improves performance and produces a more localized layout.
     *
     * The default value is infinity.
     *
     * @param distance The maximum distance between nodes over which this force is considered.
     */
    distanceMax(distance: number): this;
}

/**
 * Creates a new many-body force with the default parameters.
 *
 * The many-body (or n-body) force applies mutually amongst all nodes. It can be used to simulate gravity (attraction) if the strength is positive,
 * or electrostatic charge (repulsion) if the strength is negative. This implementation uses quadtrees and the Barnes–Hut approximation to greatly
 * improve performance; the accuracy can be customized using the theta parameter.
 *
 * Unlike links, which only affect two linked nodes, the charge force is global: every node affects every other node, even if they are on disconnected subgraphs.
 *
 * The generic refers to the type of data for a node.
 */
// eslint-disable-next-line @definitelytyped/no-unnecessary-generics
export function forceManyBody<NodeDatum extends SimulationNodeDatum>(): ForceManyBody<NodeDatum>;

// Positioning ----------------------------------------------------------------

/**
 * The x-positioning force pushes nodes towards a desired position along the given dimension with a configurable strength.
 * The strength of the force is proportional to the one-dimensional distance between the node’s position and the target position.
 * While this force can be used to position individual nodes, it is intended primarily for global forces that apply to all (or most) nodes.
 *
 * The generic refers to the type of data for a node.
 */
export interface ForceX<NodeDatum extends SimulationNodeDatum> extends Force<NodeDatum, any> {
    /**
     * Supplies the array of nodes and random source to this force. This method is called when a force is bound to a simulation via simulation.force
     * and when the simulation’s nodes change via simulation.nodes.
     *
     * A force may perform necessary work during initialization, such as evaluating per-node parameters, to avoid repeatedly performing work during each application of the force.
     */
    initialize(nodes: NodeDatum[], random: () => number): void;

    /**
     *  Returns the current strength accessor, which defaults to a constant strength for all nodes of 0.1.
     */
    strength(): (d: NodeDatum, i: number, data: NodeDatum[]) => number;
    /**
     * Sets the strength accessor to the specified number or function, re-evaluates the strength accessor for each node, and returns this force.
     * The strength determines how much to increment the node’s x-velocity: (x - node.x) × strength.
     * For example, a value of 0.1 indicates that the node should move a tenth of the way from its current x-position to the target x-position with each application.
     * Higher values moves nodes more quickly to the target position, often at the expense of other forces or constraints.
     * A value outside the range [0,1] is not recommended.
     * The strength accessor is invoked for each node in the simulation, being passed the node and its zero-based index.
     * The resulting number is then stored internally, such that the strength of each node is only recomputed when the
     * force is initialized or when this method is called with a new strength, and not on every application of the force.
     */
    strength(strength: number | ((d: NodeDatum, i: number, data: NodeDatum[]) => number)): this;

    /**
     * Return the current x-accessor, which defaults to a function returning 0 for all nodes.
     */
    x(): (d: NodeDatum, i: number, data: NodeDatum[]) => number;
    /**
     * Sets the x-coordinate accessor to the specified number or function, re-evaluates the x-accessor for each node, and returns this force.
     * The x-accessor is invoked for each node in the simulation, being passed the node and its zero-based index.
     * The resulting number is then stored internally, such that the target x-coordinate of each node is only recomputed
     * when the force is initialized or when this method is called with a new x, and not on every application of the force.
     */
    x(x: number | ((d: NodeDatum, i: number, data: NodeDatum[]) => number)): this;
}

/**
 * Creates a new positioning force along the x-axis towards the given position x.
 * If x is not specified, it defaults to 0.
 */
export function forceX<NodeDatum extends SimulationNodeDatum>(
    x?: number | ((d: NodeDatum, i: number, data: NodeDatum[]) => number),
): ForceX<NodeDatum>;

/**
 * The y-positioning force pushes nodes towards a desired position along the given dimension with a configurable strength.
 * The strength of the force is proportional to the one-dimensional distance between the node’s position and the target position.
 * While this force can be used to position individual nodes, it is intended primarily for global forces that apply to all (or most) nodes.
 *
 * The generic refers to the type of data for a node.
 */
export interface ForceY<NodeDatum extends SimulationNodeDatum> extends Force<NodeDatum, any> {
    /**
     * Supplies the array of nodes and random source to this force. This method is called when a force is bound to a simulation via simulation.force
     * and when the simulation’s nodes change via simulation.nodes.
     *
     * A force may perform necessary work during initialization, such as evaluating per-node parameters, to avoid repeatedly performing work during each application of the force.
     */
    initialize(nodes: NodeDatum[], random: () => number): void;

    /**
     *  Returns the current strength accessor, which defaults to a constant strength for all nodes of 0.1.
     */
    strength(): (d: NodeDatum, i: number, data: NodeDatum[]) => number;
    /**
     * Sets the strength accessor to the specified number or function, re-evaluates the strength accessor for each node, and returns this force.
     * The strength determines how much to increment the node’s y-velocity: (y - node.y) × strength.
     * For example, a value of 0.1 indicates that the node should move a tenth of the way from its current y-position to the target y-position with each application.
     * Higher values moves nodes more quickly to the target position, often at the expense of other forces or constraints.
     * A value outside the range [0,1] is not recommended.
     * The strength accessor is invoked for each node in the simulation, being passed the node and its zero-based index.
     * The resulting number is then stored internally, such that the strength of each node is only recomputed when the
     * force is initialized or when this method is called with a new strength, and not on every application of the force.
     */
    strength(strength: number | ((d: NodeDatum, i: number, data: NodeDatum[]) => number)): this;

    /**
     * Return the current y-accessor, which defaults to a function returning 0 for all nodes.
     */
    y(): (d: NodeDatum, i: number, data: NodeDatum[]) => number;
    /**
     * Sets the y-coordinate accessor to the specified number or function, re-evaluates the y-accessor for each node, and returns this force.
     * The y-accessor is invoked for each node in the simulation, being passed the node and its zero-based index.
     * The resulting number is then stored internally, such that the target y-coordinate of each node is only recomputed
     * when the force is initialized or when this method is called with a new y, and not on every application of the force.
     */
    y(y: number | ((d: NodeDatum, i: number, data: NodeDatum[]) => number)): this;
}

/**
 * Creates a new positioning force along the y-axis towards the given position y.
 * If y is not specified, it defaults to 0.
 */
export function forceY<NodeDatum extends SimulationNodeDatum>(
    y?: number | ((d: NodeDatum, i: number, data: NodeDatum[]) => number),
): ForceY<NodeDatum>;

/**
 * The radial force is similar to the x- and y-positioning forces, except it pushes nodes towards the closest point on a given circle.
 * The circle is of the specified radius centered at ⟨x,y⟩. If x and y are not specified, they default to ⟨0,0⟩.
 * The strength of the force is proportional to the one-dimensional distance between the node’s position and the target position.
 * While this force can be used to position individual nodes, it is intended primarily for global forces that apply to all (or most) nodes.
 *
 * The generic refers to the type of data for a node.
 */
export interface ForceRadial<NodeDatum extends SimulationNodeDatum> extends Force<NodeDatum, any> {
    /**
     * Assigns the array of nodes and random source to this force. This method is called when a force is bound to a simulation via simulation.force
     * and when the simulation’s nodes change via simulation.nodes.
     *
     * A force may perform necessary work during initialization, such as evaluating per-node parameters, to avoid repeatedly performing work during each application of the force.
     */
    initialize(nodes: NodeDatum[], random: () => number): void;

    /**
     *  Returns the current strength accessor, which defaults to a constant strength for all nodes of 0.1.
     */
    strength(): (d: NodeDatum, i: number, data: NodeDatum[]) => number;
    /**
     * Sets the strength accessor to the specified number or function, re-evaluates the strength accessor for each node, and returns this force.
     * The strength determines how much to increment the node’s x- and y-velocity.
     * For example, a value of 0.1 indicates that the node should move a tenth of the way from its current position to the closest point on the circle with each application.
     * Higher values moves nodes more quickly to the target position, often at the expense of other forces or constraints.
     * A value outside the range [0,1] is not recommended.
     * The strength accessor is invoked for each node in the simulation, being passed the node and its zero-based index.
     * The resulting number is then stored internally, such that the strength of each node is only recomputed when the
     * force is initialized or when this method is called with a new strength, and not on every application of the force.
     */
    strength(strength: number | ((d: NodeDatum, i: number, data: NodeDatum[]) => number)): this;

    /**
     * Return the current radius accessor for the circle.
     */
    radius(): (d: NodeDatum, i: number, data: NodeDatum[]) => number;
    /**
     * Sets the circle radius to the specified number or function, re-evaluates the radius accessor for each node, and returns this force.
     * The radius accessor is invoked for each node in the simulation, being passed the node and its zero-based index.
     * The resulting number is then stored internally, such that the target radius of each node is only recomputed when
     * the force is initialized or when this method is called with a new radius, and not on every application of the force.
     */
    radius(radius: number | ((d: NodeDatum, i: number, data: NodeDatum[]) => number)): this;

    /**
     * Return the current x-accessor for the circle center, which defaults to a function returning 0 for all nodes.
     */
    x(): (d: NodeDatum, i: number, data: NodeDatum[]) => number;
    /**
     * Sets the x-coordinate of the circle center to the specified number and returns this force.
     */
    x(x: number | ((d: NodeDatum, i: number, data: NodeDatum[]) => number)): this;

    /**
     * Return the current y-accessor for the circle center, which defaults to a function returning 0 for all nodes.
     */
    y(): (d: NodeDatum, i: number, data: NodeDatum[]) => number;
    /**
     * Sets the y-coordinate of the circle center to the specified number and returns this force.
     */
    y(y: number | ((d: NodeDatum, i: number, data: NodeDatum[]) => number)): this;
}

/**
 * Create a new radial positioning force towards a circle of the specified radius centered at ⟨x,y⟩.
 * If x and y are not specified, they default to ⟨0,0⟩.
 *
 * The strength of the force is proportional to the one-dimensional distance between the node’s position and the target position.
 * While this force can be used to position individual nodes, it is intended primarily for global forces that apply to all (or most) nodes.
 *
 * The generic refers to the type of data for a node.
 */
export function forceRadial<NodeDatum extends SimulationNodeDatum>(
    radius: number | ((d: NodeDatum, i: number, data: NodeDatum[]) => number),
    x?: number | ((d: NodeDatum, i: number, data: NodeDatum[]) => number),
    y?: number | ((d: NodeDatum, i: number, data: NodeDatum[]) => number),
): ForceRadial<NodeDatum>;