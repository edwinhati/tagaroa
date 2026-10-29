import { Inject, Injectable } from "@nestjs/common";

import {
  PERSON_REPOSITORY,
  type LinkedAccount,
  type PersonRepository,
} from "../../domain/repositories/person.repository";

/** The identity providers one person can sign in with. */
@Injectable()
export class ListLinkedAccountsUseCase {
  constructor(
    @Inject(PERSON_REPOSITORY) private readonly people: PersonRepository,
  ) {}

  async execute(userId: string): Promise<LinkedAccount[]> {
    return this.people.linkedAccountsOf(userId);
  }
}
