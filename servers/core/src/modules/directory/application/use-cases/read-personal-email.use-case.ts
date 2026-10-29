import { Inject, Injectable } from "@nestjs/common";

import {
  PERSON_REPOSITORY,
  type PersonRepository,
} from "../../domain/repositories/person.repository";

/**
 * The address onboarding and password reissue are delivered to.
 *
 * One person at a time, on purpose. An admin about to reissue a password needs
 * to see where the message is going before they send it; nobody needs the whole
 * group's private addresses to do that.
 */
@Injectable()
export class ReadPersonalEmailUseCase {
  constructor(
    @Inject(PERSON_REPOSITORY) private readonly people: PersonRepository,
  ) {}

  async execute(userId: string): Promise<string | null> {
    return this.people.personalEmailOf(userId);
  }
}
