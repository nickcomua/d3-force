import { dispatch } from "d3-dispatch";
import { timer } from "d3-timer";
import lcg from "./lcg.ts";
import {
  property,
  type PropertyMethod,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "./util.ts";
import type { Force } from "./force.d.ts";

const initialRadius = 10,
  initialAngle = Math.PI * (3 - Math.sqrt(5));
/**
 * A Force Simulation
 *
 * The first generic refers to the type of the datum associated with a node in the simulation.
 * The second generic refers to the type of the datum associated with a link in the simulation, if applicable.
 */
export class Simulation<
  NodeDatum extends SimulationNodeDatum,
  LinkDatum extends SimulationLinkDatum<NodeDatum>,
> {
  /**
   * Return the current alpha of the simulation, which defaults to 1.
   *
   * alpha is roughly analogous to temperature in simulated annealing.
   * It decreases over time as the simulation “cools down”.
   * When alpha reaches alphaMin, the simulation stops; see simulation.restart.

   * Set the current alpha to the specified number in the range [0,1] and return this simulation.
   * The default is 1.
   *
   * alpha is roughly analogous to temperature in simulated annealing.
   * It decreases over time as the simulation “cools down”.
   * When alpha reaches alphaMin, the simulation stops; see simulation.restart.
   *
   */
  @property({
    validator: (value: number) => value >= 0 && value <= 1,
  })
  alpha!: PropertyMethod<number, this>;
  _alpha = 1.0;

  /**
   * Return the current minimum alpha value, which defaults to 0.001.
   *
   * Set the minimum alpha to the specified number in the range [0,1] and return this simulation.
   * The default is 0.001. The simulation’s internal timer stops when the current alpha is less than the minimum alpha.
   * The default alpha decay rate of ~0.0228 corresponds to 300 iterations.
   *
   * @param min Minimum alpha of simulation.
   */
  @property({
    validator: (value: number) => value >= 0 && value <= 1,
  })
  alphaMin!: PropertyMethod<number, this>;
  private _alphaMin = 0.001;

  /**
   * Return the current alpha decay rate, which defaults to 0.0228… = 1 - pow(0.001, 1 / 300) where 0.001 is the default minimum alpha.
   *
   * Set the alpha decay rate to the specified number in the range [0,1] and return this simulation.
   * The default is 0.0228… = 1 - pow(0.001, 1 / 300) where 0.001 is the default minimum alpha.
   *
   * The alpha decay rate determines how quickly the current alpha interpolates towards the desired target alpha;
   * since the default target alpha is zero, by default this controls how quickly the simulation cools.
   * Higher decay rates cause the simulation to stabilize more quickly, but risk getting stuck in a local minimum;
   * lower values cause the simulation to take longer to run, but typically converge on a better layout.
   * To have the simulation run forever at the current alpha, set the decay rate to zero;
   * alternatively, set a target alpha greater than the minimum alpha.
   */
  @property({
    validator: (value: number) => value >= 0 && value <= 1,
  })
  alphaDecay!: PropertyMethod<number, this>;
  _alphaDecay = 1 - Math.pow(0.001, 1 / 300);

  /**
   * Returns the current target alpha value, which defaults to 0.
   *
   * Set the current target alpha to the specified number in the range [0,1] and return this simulation.
   * The default is 0.
   */
  @property({
    validator: (value: number) => value >= 0 && value <= 1,
  })
  alphaTarget!: PropertyMethod<number, this>;
  private _alphaTarget = 0;

  /**
   * Return the current target alpha value, which defaults to 0.4.
   *
   * Set the velocity decay factor to the specified number in the range [0,1] and return this simulation.
   * The default is 0.4.
   *
   * The decay factor is akin to atmospheric friction; after the application of any forces during a tick,
   * each node’s velocity is multiplied by 1 - decay. As with lowering the alpha decay rate,
   * less velocity decay may converge on a better solution, but risks numerical instabilities and oscillation.
   */
  @property({
    validator: (value: number) => value >= 0 && value <= 1,
    transform: (value: number) => 1 - value,
  })
  velocityDecay!: PropertyMethod<number, this>;
  private _velocityDecay = 0.6;

  /**
   * Returns the simulation’s array of nodes as specified to the constructor.
   *
   * Set the simulation’s nodes to the specified array of objects, initialize their positions and velocities if necessary,
   * and then re-initialize any bound forces; Returns the simulation.
   *
   * Each node must be an object. The following properties are assigned by the simulation:
   * - index (the node’s zero-based index into nodes)
   * - x (the node’s current x-position)
   * - y (the node’s current y-position)
   * - vx (the node’s current x-velocity)
   * - vy (the node’s current y-velocity)
   *
   * The position [x,y] and velocity [vx,vy] may be subsequently modified by forces and by the simulation.
   * If either vx or vy is NaN, the velocity is initialized to [0,0]. If either x or y is NaN, the position is initialized in a phyllotaxis arrangement,
   * so chosen to ensure a deterministic, uniform distribution.
   *
   * To fix a node in a given position, you may specify two additional properties:
   * - fx (the node’s fixed x-position)
   * - fy (the node’s fixed y-position)
   *
   * At the end of each tick, after the application of any forces, a node with a defined node.fx has node.x reset to this value and node.vx set to zero;
   * likewise, a node with a defined node.fy has node.y reset to this value and node.vy set to zero.
   * To unfix a node that was previously fixed, set node.fx and node.fy to null, or delete these properties.
   *
   * If the specified array of nodes is modified, such as when nodes are added to or removed from the simulation,
   * this method must be called again with the new (or changed) array to notify the simulation and bound forces of the change;
   * the simulation does not make a defensive copy of the specified array.
   */
  @property({
    onSet: function (
      this: Simulation<NodeDatum, LinkDatum>,
      nodes: NodeDatum[],
    ) {
      this.initializeNodes();
      this.forces.forEach((force)=>this.initializeForce(force));
    },
  })
  nodes!: PropertyMethod<NodeDatum[], this>;
  private _nodes: NodeDatum[] = [];

  /**
   * Returns this simulation’s current random source which defaults to a fixed-seed linear congruential generator.
   * See also random.source.
   *
   * Sets the function used to generate random numbers; this should be a function that returns a number between 0 (inclusive) and 1 (exclusive).
   *
   * @param source The function used to generate random numbers.
   */
  @property<Simulation<NodeDatum,LinkDatum>,() => number>()
  randomSource!: PropertyMethod<() => number, this>;
  private _randomSource = lcg();

  private stepper = timer(() => this.step());
  private event = dispatch("tick", "end");
  private forces = new Map<string, Force<NodeDatum,LinkDatum>>();

  private initializeNodes() {
    const nodes = this._nodes;
    for (let i = 0, node; i < nodes.length; ++i) {
      node = nodes[i], node.index = i;
      if (node.fx != null) node.x = node.fx;
      if (node.fy != null) node.y = node.fy;
      if (isNaN(node.x) || isNaN(node.y)) {
        const radius = initialRadius * Math.sqrt(0.5 + i);
        const angle = i * initialAngle;
        node.x = radius * Math.cos(angle);
        node.y = radius * Math.sin(angle);
      }
      if (isNaN(node.vx) || isNaN(node.vy)) {
        node.vx = node.vy = 0;
      }
    }
  }

  /**
   * Return the force with the specified name, or undefined if there is no such force.
   * (By default, new simulations have no forces.)
   *
   * Given that it is in general not known, what type of force has been registered under
   * a specified name, use the generic to cast the result to the appropriate type, if known.
   *
   * @param name Name of the registered force.
   */
  // eslint-disable-next-line @definitelytyped/no-unnecessary-generics
  force<F extends Force<NodeDatum, LinkDatum>>(name: string): F | undefined;
  /**
   * If force is specified, assigns the force for the specified name and returns this simulation.
   * To remove the force with the given name, pass null as the force.
   */
  force(name: string, force: null | Force<NodeDatum, LinkDatum>): this;
  force(name: string, force?: null | Force<NodeDatum, LinkDatum>) {
    return arguments.length > 1
      ? ((!force
        ? this.forces.delete(name)
        : this.forces.set(name, this.initializeForce(force))),
        this)
      : this.forces.get(name);
  }

  private initializeForce(force: Force<NodeDatum, LinkDatum>) {
    if (force.initialize) force.initialize(this._nodes, this._randomSource);
    return force;
  }
  /**
   * Restart the simulation’s internal timer and return the simulation.
   * In conjunction with simulation.alphaTarget or simulation.alpha, this method can be used to “reheat” the simulation during interaction,
   * such as when dragging a node, or to resume the simulation after temporarily pausing it with simulation.stop.
   */
  restart() {
    this.stepper.restart(this.step);
    return this;
  }

  /**
   * Stop the simulation’s internal timer, if it is running, and return the simulation. If the timer is already stopped, this method does nothing.
   * This method is useful for running the simulation manually; see simulation.tick.
   */
  stop() {
    this.stepper.stop();
    return this;
  }

  private step() {
    this.tick();
    this.event.call("tick", this);
    if (this.alpha() < this.alphaMin()) {
      this.stepper.stop();
      this.event.call("end", this);
    }
  }
  /**
   * Manually steps the simulation by the specified number of *iterations*, and returns the simulation. If *iterations* is not specified, it defaults to 1 (single step).
   *
   * For each iteration, it increments the current alpha by (alphaTarget - alpha) × alphaDecay; then invokes each registered force, passing the new alpha;
   * then decrements each node’s velocity by velocity × velocityDecay; lastly increments each node’s position by velocity.
   *
   * This method does not dispatch events; events are only dispatched by the internal timer when the simulation is started automatically upon
   * creation or by calling simulation.restart. The natural number of ticks when the simulation is started is
   * ⌈log(alphaMin) / log(1 - alphaDecay)⌉; by default, this is 300.
   */
  tick(iterations?: number) {
    const n = this._nodes.length;

    if (iterations === undefined) iterations = 1;

    for (let k = 0; k < iterations; ++k) {
      this._alpha += (this._alphaTarget - this._alpha) * this._alphaDecay;

      this.forces.forEach((force) => {
        force(this._alpha);
      });
      for (let i = 0; i < n; ++i) {
        const node = this._nodes[i];
        if (node.fx == null) node.x += node.vx *= this._velocityDecay;
        else node.x = node.fx, node.vx = 0;
        if (node.fy == null) node.y += node.vy *= this._velocityDecay;
        else node.y = node.fy, node.vy = 0;
      }
    }
    return this;
  }

  /**
   * Return the node closest to the position [x,y] with the given search radius.
   * If radius is not specified, it defaults to infinity.
   * If there is no node within the search area, returns undefined.
   *
   * @param x x-coordinate
   * @param y y-coordinate
   * @param radius Optional search radius. Defaults to infinity.
   */
  find(x: number, y: number, radius?: number) {
    const n = this._nodes.length;
    let i = 0,
      dx,
      dy,
      d2,
      node,
      closest;

    if (radius == null) radius = Infinity;
    else radius *= radius;

    for (i = 0; i < n; ++i) {
      node = this._nodes[i];
      dx = x - node.x;
      dy = y - node.y;
      d2 = dx * dx + dy * dy;
      if (d2 < radius) closest = node, radius = d2;
    }

    return closest;
  }

  /**
   * Return the first currently-assigned listener matching the specified typenames, if any.
   *
   * @param typenames The typenames is a string containing one or more typename separated by whitespace. Each typename is a type,
   * optionally followed by a period (.) and a name, such as "tick.foo" and "tick.bar"; the name allows multiple listeners to be registered for the same type.
   * The type must be one of the following: "tick" (after each tick of the simulation’s internal timer) or
   * "end" (after the simulation’s timer stops when alpha < alphaMin).
   */
  on(
    typenames: "tick" | "end" | string,
  ): ((this: Simulation<NodeDatum, LinkDatum>) => void) | undefined;
  /**
   * Sets the event listener for the specified typenames and returns this simulation.
   * If an event listener was already registered for the same type and name, the existing listener is removed before the new listener is added.
   * If listener is null, removes the current event listeners for the specified typenames, if any.
   * When a specified event is dispatched, each listener will be invoked with the this context as the simulation.
   */
  on(
    typenames: "tick" | "end" | string,
    listener: null | ((this: this) => void),
  ): this;
  on(
    typenames: "tick" | "end" | string,
    listener?: null | ((this: this) => void),
  ) {
    return arguments.length > 1
      ? (this.event.on(typenames, listener), this)
      : this.event.on(typenames);
  }
}

export function x(d: SimulationNodeDatum) {
  return d.x;
}

export function y(d: SimulationNodeDatum) {
  return d.y;
}

/**
 * Create a new simulation with the specified array of nodes and no forces.
 * If nodes is not specified, it defaults to the empty array.
 * The simulator starts automatically; use simulation.on to listen for tick events as the simulation runs.
 * If you wish to run the simulation manually instead, call simulation.stop, and then call simulation.tick as desired.
 *
 * Use this signature, when creating a simulation WITH link force(s).
 *
 * The first generic refers to the type of data for a node.
 * The second generic refers to the type of data for a link.
 *
 * @param nodesData Optional array of nodes data, defaults to empty array.
 */ 
export function forceSimulation<
  NodeDatum extends SimulationNodeDatum = SimulationNodeDatum,
  LinkDatum extends SimulationLinkDatum<NodeDatum> = SimulationLinkDatum<NodeDatum>,
>(nodesData?: NodeDatum[]): Simulation<NodeDatum, LinkDatum> {
  if (!nodesData) nodesData = [];
  return new Simulation<NodeDatum, LinkDatum>().nodes(nodesData);
}
