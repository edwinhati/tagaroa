export interface SubsidiaryProps {
  id: string;
  name: string;
  slug: string;
}

/** One company in the group. Better Auth calls it an organization. */
export class Subsidiary {
  private constructor(private readonly props: SubsidiaryProps) {}

  static restore(props: SubsidiaryProps): Subsidiary {
    return new Subsidiary(props);
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get slug(): string {
    return this.props.slug;
  }
}

export interface TeamProps {
  id: string;
  name: string;
  organizationId: string;
  memberIds: string[];
}

/**
 * A team inside a subsidiary, carrying its people.
 *
 * The team's name is what admits someone to a working domain — `admit()` in
 * `@repo/shell` matches it against the domain registry — so a team is a
 * membership list and an access rule at once.
 */
export class Team {
  private constructor(private readonly props: TeamProps) {}

  static restore(props: TeamProps): Team {
    return new Team(props);
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }

  get memberIds(): string[] {
    return [...this.props.memberIds];
  }
}
