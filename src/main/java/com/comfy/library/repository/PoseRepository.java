package com.comfy.library.repository;

import com.comfy.library.entity.PoseEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PoseRepository extends JpaRepository<PoseEntity, Long> {
}
