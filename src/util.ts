/**
 * The base data structure for the datum of a Simulation Node.
 * The optional properties contained in this data structure are internally assigned
 * by the Simulation upon (re-)initialization.
 *
 * When defining a data type to use for node data, it should be an extension of this interface
 * and respect the already "earmarked" properties used by the simulation.
 *
 * IMPORTANT: Prior to initialization, the following properties are optional: index, x, y, vx, and vy.
 * After initialization they will be defined. The optional properties fx and fy are ONLY defined,
 * if the node's position has been fixed.
 */
export interface SimulationNodeDatum {
  /**
   * Node’s zero-based index into nodes array. This property is set during the initialization process of a simulation.
   */
  index?: number | undefined;
  /**
   * Node’s current x-position
   */
  x?: number | undefined;
  /**
   * Node’s current y-position
   */
  y?: number | undefined;
  /**
   * Node’s current x-velocity
   */
  vx?: number | undefined;
  /**
   * Node’s current y-velocity
   */
  vy?: number | undefined;
  /**
   * Node’s fixed x-position (if position was fixed)
   */
  fx?: number | null | undefined;
  /**
   * Node’s fixed y-position (if position was fixed)
   */
  fy?: number | null | undefined;
}

/**
 * The base data structure for the datum of a Simulation Link, as used by ForceLink.
 * The optional properties contained in this data structure are internally assigned
 * by when initializing with ForceLink.links(...)
 *
 * IMPORTANT: The source and target properties may be internally mutated in type during the
 * ForceLink initialization process (possibly being changed from a node index in the nodes array,
 * or a node id string to the simulation node object which was mapped in using the current
 * ForceLink.id(...) accessor function.)
 */
export interface SimulationLinkDatum<NodeDatum extends SimulationNodeDatum> {
  /**
   * Link’s source node.
   * For convenience, a link’s source and target properties may be initialized using numeric or string identifiers rather than object references; see link.id.
   * When the link force is initialized (or re-initialized, as when the nodes or links change), any link.source or link.target property which is not an object
   * is replaced by an object reference to the corresponding node with the given identifier.
   * After initialization, the source property represents the source node object.
   */
  source: NodeDatum | string | number;
  /**
   * Link’s source link
   * For convenience, a link’s source and target properties may be initialized using numeric or string identifiers rather than object references; see link.id.
   * When the link force is initialized (or re-initialized, as when the nodes or links change), any link.source or link.target property which is not an object
   * is replaced by an object reference to the corresponding node with the given identifier.
   * After initialization, the target property represents the target node object.
   */
  target: NodeDatum | string | number;
  /**
   * The zero-based index into the links array. Internally generated when calling ForceLink.links(...)
   */
  index?: number | undefined;
}

// Define the overloaded method signature
export type PropertyMethod<T, TThis> = {
  (): T;
  (value: T): TThis;
};

export function property<TThis, T>(options?: {
  onGet?: (this: TThis, value: T) => void;
  onSet?: (this: TThis, oldValue: T, newValue: T) => void;
  validator?: (value: T) => boolean;
  transform?: (value: T) => T;
}) {
  return function <TTarget extends PropertyMethod<T, TThis>>(
    value: undefined,
    context: ClassFieldDecoratorContext<TThis, TTarget>,
  ) {
    // Only work with field decorators
    if (context.kind !== "field") {
      throw new Error("@property can only be used on fields");
    }

    const privateKey = `_${String(context.name)}`;

    // Return an initializer function that will be called with the initial field value
    return function (this: TThis, initialValue: TTarget): TTarget {
      const self = this;

      // Create the property method
      const method = function (this: TThis, value?: T): T | TThis {
        if (arguments.length === 0) {
          // Getter behavior
          let currentValue = (self as any)[privateKey];
          if (options?.transform) {
            currentValue = options.transform(currentValue);
          }
          options?.onGet?.call?.(self, currentValue);
          return currentValue;
        } else {
          // Setter behavior
          let newValue = value!;

          if (options?.validator && !options.validator(newValue)) {
            throw new Error(
              `Invalid value for ${String(context.name)}: ${newValue}`,
            );
          }

          if (options?.transform) {
            newValue = options.transform(newValue);
          }

          const oldValue = (self as any)[privateKey];
          (self as any)[privateKey] = newValue;
          options?.onSet?.call(self, oldValue, newValue);
          return self;
        }
      } as TTarget;

      return method;
    };
  };
}

// class Simulation {
//   @property({
//     validator: (value: number) => value >= 0 && value <= 1,
//     onSet: function (this, value) {
//       console.log("onSet", this, value);
//     },
//     onGet: function (this, value) {
//       console.log("onGet", this, value);
//     },
//   })
//   alphaDecay!: PropertyMethod<number, this>;
//   _alphaDecay = 1 - Math.pow(0.001, 1 / 300);
// }

// const sim = new Simulation();
// console.log(sim);
// console.log(sim.alphaDecay()); // Gets the current value
// sim.alphaDecay(0.5); // Sets a new value
// console.log(sim.alphaDecay()); // Should return 0.5

// Helper type to extract the instance type
export type GetInstanceType<T> = T extends new (...args: any[]) => infer R ? R
  : T;
